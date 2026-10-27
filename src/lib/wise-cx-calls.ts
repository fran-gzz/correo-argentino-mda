/**
 * Estado de llamadas en vivo de Wise CX Analytics.
 *
 * Fuente de datos (medida contra analytics.wcx.cloud el 2026-10-21):
 *  - KPIs por estado: widget "Estado de Llamadas" (type 53) del tab público.
 *    Series: total_call_active, total_call_attended, total_call_ringing,
 *    total_call_ivr, total_call_enqueued, avg_call_wait_time, total_call_overflow.
 *  - Detalle fila por fila: `getCallsListData` sobre un widget de llamadas
 *    (type 76) con series extendidas: call_agent, call_status, call_created,
 *    call_wait_time, company_ticket (id del caso de InvGate), call_group.
 *
 * Notas de comportamiento verificadas:
 *  - `getCallsListData` devuelve `data: null` (sin error) cuando el WQL es
 *    inválido: hay que validarlo explícitamente.
 *  - El WQL `call_group IN (<id>)` funciona, pero deja el conjunto vacío si el
 *    grupo no tuvo llamadas: por eso el filtro por grupo se aplica en el
 *    portal (sobre el nombre del grupo), no en el WQL.
 *  - `orderBy: call_created DESC` no se aplica en el backend: las filas llegan
 *    en orden ascendente y el portal las reordena.
 *  - `call_created` viene en hora local de Wise (offset de la cuenta, -03:00),
 *    no en UTC: hay que parsearlo con el offset explícito.
 */

import {
  buildReportValues,
  getWidgetData,
  getCallsListData,
  loadAnalyticsPage,
  type WiseAnalyticsGroup,
  type WiseAnalyticsPage,
  type WiseAnalyticsWidget,
} from "@/lib/wise-cx-analytics";
import {
  classifyLlamadaEstado,
  normalizeLlamadaText,
  LLAMADA_ESTADO_LABELS,
  LLAMADA_ESTADOS_VIVOS,
  type LlamadaEstado,
} from "@/lib/llamadas/estados";

export type WiseCallState = LlamadaEstado;
export const WISE_CALL_STATE_LABELS = LLAMADA_ESTADO_LABELS;
export const LIVE_CALL_STATES = LLAMADA_ESTADOS_VIVOS;
export const normalizeCallText = normalizeLlamadaText;
export const classifyWiseCallState = classifyLlamadaEstado;

/** TTL del snapshot en memoria: 10 s (el propio widget de Wise refresca a 5 s). */
const SNAPSHOT_TTL_MS = 10_000;
/** TTL del catálogo (grupos/agentes del tab): 10 min. */
const PAGE_TTL_MS = 10 * 60_000;
/** Tope de filas de detalle traídas por snapshot (evita payloads gigantes). */
const MAX_DETAIL_ROWS = 400;
const DETAIL_PAGE_SIZE = 200;

const DEFAULT_KPI_WIDGET_ID = 464249;
const DEFAULT_DETAIL_WIDGET_ID = 464546;

export interface WiseCallLive {
  callId: number;
  convId: number | null;
  movId: number | null;
  /** Agente asignado en Wise (nombre completo). */
  agentName: string;
  /** Email del agente en InvGate, si se pudo cruzar por nombre. */
  agentEmail: string | null;
  /** Estado crudo de Wise (para depuración y tooltip). */
  rawStatus: string;
  state: WiseCallState;
  stateLabel: string;
  groupId: number | null;
  groupName: string;
  /** ISO UTC del inicio de la llamada. */
  createdAt: string;
  createdAtLocal: string;
  /** Segundos que la llamada lleva en el estado actual. */
  elapsedSeconds: number;
  /** Tiempo de espera reportado por Wise (segundos). */
  waitSeconds: number;
  /** Id del caso de InvGate asociado (company_ticket). 0 = sin caso. */
  caseId: number | null;
  /** Bandera "Caso asociado" (SI/NO). */
  associatedCase: string;
}

export interface WiseCallsKpi {
  /** Llamadas en curso + en cola (tooltip del widget). */
  active: number;
  /** En curso (atendidas por un agente). */
  attended: number;
  /** Sonando (en el ring del agente). */
  ringing: number;
  /** En cola (esperando asignación, sin agente). */
  enqueued: number;
  /** En IVR. */
  ivr: number;
  /** Desbordes (llamadas que no ingresaron al sistema). */
  overflow: number;
  /** Espera promedio de las llamadas en cola, en segundos. */
  avgWaitSeconds: number;
  avgWaitLabel: string;
}

export interface WiseCallsSnapshot {
  kpis: WiseCallsKpi;
  calls: WiseCallLive[];
  groups: WiseAnalyticsGroup[];
  /** Timestamp de la toma de datos (ISO). */
  fetchedAt: string;
  /** true cuando el snapshot no se pudo refrescar y se sirve el anterior. */
  stale: boolean;
  /** Mensaje de error legible (solo si stale o sin datos). */
  warning?: string;
}

const EMPTY_KPI: WiseCallsKpi = {
  active: 0,
  attended: 0,
  ringing: 0,
  enqueued: 0,
  ivr: 0,
  overflow: 0,
  avgWaitSeconds: 0,
  avgWaitLabel: "0s",
};

/* -------------------------------------------------------------------------- */
/* Normalización                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Parsea la duración de Wise ("0s", "1m 30s", "2h 5m") a segundos.
 */
export function parseWiseDuration(value: string): number {
  if (!value) return 0;
  const text = value.trim().toLowerCase();
  const hours = /(\d+)\s*h/.exec(text);
  const minutes = /(\d+)\s*m/.exec(text);
  const seconds = /(\d+)\s*s/.exec(text);
  return (
    (hours ? Number(hours[1]) * 3600 : 0) +
    (minutes ? Number(minutes[1]) * 60 : 0) +
    (seconds ? Number(seconds[1]) : 0)
  );
}

/** Formatea segundos como "1m 30s" / "2h 05m". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}

function getTimezoneOffset(): string {
  const raw = process.env.WISE_CX_TIMEZONE_OFFSET || "-03:00";
  return /^[+-]\d{2}:\d{2}$/.test(raw) ? raw : "-03:00";
}

/**
 * Parsea la fecha de Wise ("2026-10-21 12:12:07.0000") aplicando el offset
 * de la cuenta. Devuelve null si no es parseable.
 */
export function parseWiseDateTime(
  value: string,
  offset = getTimezoneOffset(),
): Date | null {
  if (!value) return null;
  const cleaned = value.trim().replace(" ", "T").replace(/\.\d+$/, "");
  if (!cleaned) return null;
  const parsed = new Date(`${cleaned}${offset}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/* -------------------------------------------------------------------------- */
/* Caché del tab (widgets + grupos)                                           */
/* -------------------------------------------------------------------------- */

let pageCache: { data: WiseAnalyticsPage; timestamp: number } | null = null;
let pageInFlight: Promise<WiseAnalyticsPage> | null = null;

async function getAnalyticsPage(): Promise<WiseAnalyticsPage> {
  const now = Date.now();
  if (pageCache && now - pageCache.timestamp < PAGE_TTL_MS) {
    return pageCache.data;
  }
  if (pageInFlight) return pageInFlight;

  pageInFlight = (async () => {
    const result = await loadAnalyticsPage();
    if (result.ok) {
      pageCache = { data: result.data, timestamp: Date.now() };
      return result.data;
    }
    console.error("[Wise CX Calls] No se pudo cargar el tab:", result.message);
    return pageCache?.data ?? { tab: null, groups: [], agents: [] };
  })();

  try {
    return await pageInFlight;
  } finally {
    pageInFlight = null;
  }
}

function findWidget(
  page: WiseAnalyticsPage,
  widgetId: number,
): WiseAnalyticsWidget | null {
  return page.tab?.widgets?.find((widget) => widget.id === widgetId) ?? null;
}

/* -------------------------------------------------------------------------- */
/* KPIs                                                                       */
/* -------------------------------------------------------------------------- */

interface WiseKpiRow {
  total_call_active?: number;
  total_call_attended?: number;
  total_call_ringing?: number;
  total_call_ivr?: number;
  total_call_enqueued?: number;
  total_call_overflow?: number;
  avg_call_wait_time?: string;
}

const KPI_SERIES = [
  { field: "total_call_active", type: "number" },
  { field: "total_call_attended", type: "number" },
  { field: "total_call_ringing", type: "number" },
  { field: "total_call_ivr", type: "number" },
  { field: "total_call_enqueued", type: "number" },
  { field: "avg_call_wait_time", type: "time" },
  { field: "total_call_overflow", type: "number" },
];

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchKpis(page: WiseAnalyticsPage): Promise<WiseCallsKpi> {
  const widgetId = toNumber(
    process.env.WISE_CX_CALLS_WIDGET_ID || DEFAULT_KPI_WIDGET_ID,
  );
  const base = findWidget(page, widgetId);
  if (!base) return { ...EMPTY_KPI };

  const widget = {
    ...base,
    config: {
      ...base.config,
      series: KPI_SERIES,
      pageNumber: 0,
      pageSize: 10,
    },
  };

  const result = await getWidgetData<WiseKpiRow>({
    widgetType: base.type,
    widgetId,
    widget,
    reportValues: buildReportValues(),
  });

  if (!result.ok) {
    console.error("[Wise CX Calls] KPIs no disponibles:", result.message);
    return { ...EMPTY_KPI };
  }

  const row = result.data.list?.[0];
  if (!row) return { ...EMPTY_KPI };

  const waitLabel = row.avg_call_wait_time ?? "0s";
  return {
    active: toNumber(row.total_call_active),
    attended: toNumber(row.total_call_attended),
    ringing: toNumber(row.total_call_ringing),
    enqueued: toNumber(row.total_call_enqueued),
    ivr: toNumber(row.total_call_ivr),
    overflow: toNumber(row.total_call_overflow),
    avgWaitSeconds: parseWiseDuration(waitLabel),
    avgWaitLabel: waitLabel,
  };
}

/* -------------------------------------------------------------------------- */
/* Detalle                                                                    */
/* -------------------------------------------------------------------------- */

interface WiseCallRow {
  call_num?: number;
  call_auto_id?: number;
  conv_auto_id?: number;
  mov_auto_id?: number;
  call_agent?: string;
  call_status?: string;
  call_created?: string;
  call_wait_time?: number;
  company_ticket?: string | number;
  call_group?: string;
  call_associated_case?: string;
}

const DETAIL_SERIES = [
  { field: "call_num", type: "number" },
  { field: "call_agent", type: "string" },
  { field: "call_status", type: "string" },
  { field: "call_created", type: "datetime" },
  { field: "call_wait_time", type: "number" },
  { field: "company_ticket", type: "string" },
  { field: "call_group", type: "string" },
  { field: "call_associated_case", type: "string" },
];

/** true si Wise reporta un agente real (no vacío ni "[Sin Asignar]"). */
function hasAssignedAgent(agentName: string): boolean {
  const key = agentName.trim().toLowerCase();
  return key !== "" && key !== "[sin asignar]" && key !== "sin asignar";
}

function mapCallRow(
  row: WiseCallRow,
  groupIdByName: Map<string, number>,
  now: number,
): WiseCallLive | null {  const callId = toNumber(row.call_num ?? row.call_auto_id);
  if (!callId) return null;

  const rawStatus = (row.call_status ?? "").trim();
  const agentName = (row.call_agent ?? "").trim();

  let state = classifyWiseCallState(rawStatus);
  // Wise reporta el hold como "En Cola". Si la llamada ya tiene agente, no
  // esta esperando en la cola: es una llamada atendida que quedo en espera.
  if (state === "en_cola" && hasAssignedAgent(agentName)) {
    state = "en_espera";
  }

  const groupName = (row.call_group ?? "").trim();
  const created = parseWiseDateTime(row.call_created ?? "");
  const createdIso = created ? created.toISOString() : "";

  const caseRaw = row.company_ticket;
  const caseId =
    caseRaw === undefined || caseRaw === null || String(caseRaw).trim() === "0"
      ? null
      : toNumber(caseRaw);

  return {
    callId,
    convId: row.conv_auto_id ? toNumber(row.conv_auto_id) : null,
    movId: row.mov_auto_id ? toNumber(row.mov_auto_id) : null,
    agentName,
    agentEmail: null,
    rawStatus,
    state,
    stateLabel: WISE_CALL_STATE_LABELS[state],
    groupId: groupIdByName.get(normalizeCallText(groupName)) ?? null,
    groupName: groupName || "[Sin Asignar]",
    createdAt: createdIso,
    createdAtLocal: (row.call_created ?? "").trim(),
    elapsedSeconds: created ? Math.max(0, Math.floor((now - created.getTime()) / 1000)) : 0,
    waitSeconds: toNumber(row.call_wait_time),
    caseId: caseId && caseId > 0 ? caseId : null,
    associatedCase: (row.call_associated_case ?? "").trim(),
  };
}

async function fetchCalls(
  page: WiseAnalyticsPage,
  groupId?: number | null,
): Promise<{ rows: WiseCallLive[]; warning?: string }> {
  const widgetId = toNumber(
    process.env.WISE_CX_CALLS_DETAIL_WIDGET_ID || DEFAULT_DETAIL_WIDGET_ID,
  );
  const base = findWidget(page, widgetId);
  if (!base) {
    return { rows: [], warning: "No se encontró el widget de detalle en Wise." };
  }

  const groupIdByName = new Map(
    page.groups.map((group) => [normalizeCallText(group.name), group.id]),
  );

  const rows: WiseCallRow[] = [];
  let pageNumber = 1;
  let total = 0;
  let warning: string | undefined;

  // El WQL con grupo reduce el volumen, pero si el backend lo rechaza
  // (data: null) se reintenta sin filtro y se aplica el filtro local.
  const wqlCandidates = [
    buildWql(groupId),
    `call_created IN ${DETAIL_WINDOW}`,
    `call_created IN ${DETAIL_WINDOW_FALLBACK}`,
  ];

  for (const wql of wqlCandidates) {
    rows.length = 0;
    pageNumber = 1;
    total = 0;
    warning = undefined;

    while (rows.length < MAX_DETAIL_ROWS) {
      const widget = {
        ...base,
        wql,
        config: {
          ...base.config,
          series: DETAIL_SERIES,
          pageNumber: pageNumber - 1,
          pageSize: DETAIL_PAGE_SIZE,
        },
      };

      const result = await getCallsListData<WiseCallRow>({
        widgetId,
        page: pageNumber,
        widget,
        reportValues: buildReportValues(),
      });

      if (!result.ok) {
        warning = result.message;
        break;
      }

      const list = result.data.list ?? [];
      total = result.data.total ?? 0;
      rows.push(...list);

      if (list.length === 0 || rows.length >= total) break;
      pageNumber += 1;
    }

    if (rows.length > 0 || wql === wqlCandidates[wqlCandidates.length - 1]) {
      break;
    }
  }

  if (rows.length < total && rows.length > 0) {
    warning =
      warning ??
      `Se trayeron ${rows.length} de ${total} llamadas de la ventana consultada (tope ${MAX_DETAIL_ROWS}).`;
  }

  const now = Date.now();
  return {
    rows: rows
      .map((row) => mapCallRow(row, groupIdByName, now))
      .filter((call): call is WiseCallLive => call !== null),
    warning,
  };
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                   */
/* -------------------------------------------------------------------------- */

interface CacheEntry {
  data: WiseCallsSnapshot;
  timestamp: number;
}

const snapshotCache = new Map<string, CacheEntry>();
const snapshotInFlight = new Map<string, Promise<WiseCallsSnapshot>>();

export interface WiseCallsOptions {
  /** Id del grupo de Wise (call_group) a filtrar. Sin valor = todos. */
  groupId?: number | null;
  /** Ignora la caché y vuelve a pedir datos a Wise. */
  forceRefresh?: boolean;
}

/**
 * Ventana temporal del listado.
 *
 * Se usa una ventana relativa (6 h) y no el día completo porque la API
 * devuelve las llamadas en orden ASC y con `pageSize` acotado: con el día
 * entero, un día de alto volumen truncaría las filas y se perderían
 * justamente las más recientes (las vivas).
 */
const DETAIL_WINDOW = "#Last6Hours#";
const DETAIL_WINDOW_FALLBACK = "#Today#";

function buildWql(groupId?: number | null): string {
  const base = `call_created IN ${DETAIL_WINDOW}`;
  if (!groupId) return base;
  return `${base} AND call_group IN (${groupId})`;
}

/**
 * Devuelve el snapshot de llamadas en vivo.
 *
 * Cache de 10 s por grupo + single-flight: N usuarios mirando la vista
 * generan una sola consulta a Wise por ventana.
 */
export async function getWiseCallsSnapshot(
  options: WiseCallsOptions = {},
): Promise<WiseCallsSnapshot> {
  const groupId = options.groupId ?? null;
  const key = groupId === null ? "all" : String(groupId);
  const now = Date.now();

  if (!options.forceRefresh) {
    const cached = snapshotCache.get(key);
    if (cached && now - cached.timestamp < SNAPSHOT_TTL_MS) {
      return cached.data;
    }
    const inFlight = snapshotInFlight.get(key);
    if (inFlight) return inFlight;
  }

  const promise = (async (): Promise<WiseCallsSnapshot> => {
    const page = await getAnalyticsPage();
    const [kpis, detail] = await Promise.all([
      fetchKpis(page),
      fetchCalls(page, groupId),
    ]);

    const calls = detail.rows
      .filter((call) => LIVE_CALL_STATES.includes(call.state))
      .filter((call) => groupId === null || call.groupId === groupId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const snapshot: WiseCallsSnapshot = {
      kpis,
      calls,
      groups: page.groups,
      fetchedAt: new Date().toISOString(),
      stale: false,
      warning: detail.warning,
    };

    snapshotCache.set(key, { data: snapshot, timestamp: Date.now() });
    return snapshot;
  })();

  snapshotInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    snapshotInFlight.delete(key);
  }
}

/** Libera la caché en memoria (tests / reload manual). */
export function invalidateWiseCallsCache(): void {
  snapshotCache.clear();
}
