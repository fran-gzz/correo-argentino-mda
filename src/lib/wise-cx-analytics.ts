/**
 * Cliente HTTP de Wise CX Analytics (analytics.wcx.cloud).
 *
 * A diferencia de `wise-cx-client.ts` (API core de Wise CX, que exige
 * `x-api-key` + `Bearer`), los endpoints `Reports.svc/*` de Analytics son
 * PÚBLICOS: se resuelven con `{ codeCompany, tab_guid }` y no requieren token.
 * Verificado contra analytics.wcx.cloud el 2026-10-21.
 *
 * Contrato de los endpoints (medido, no inferido):
 *  - `POST /Reports.svc/LoadPage`  body `{ reportValues: { codeCompany, tab_guid } }`
 *      -> `{ d: "<json>" }` con `{ status, code, data: { tabs: [...], groups, agents, ... } }`.
 *      El shape plano `{ codeCompany, tab_guid }` devuelve 500 INVALID_LOGIN.
 *  - `POST /Reports.svc/getDataReportByWidget`
 *      body `{ widgetType, widgetID, widget, reportValues }`
 *      -> `data: { total, list: [...] }`.
 *  - `POST /Reports.svc/getCallsListData`
 *      body `{ widgetID, page, widget, reportValues, getTotals }`
 *      -> `data: { total, list: [...] }`.
 *
 * Todos devuelven el JSON serializado dentro de la clave `d` (string), y el
 * envelope interno `{ status, code, data }` donde `status` es "200" o "500".
 * Un WQL inválido devuelve `data: null` SIN error: hay que validarlo siempre.
 */

import type { InvgateResult } from "@/types/invgate";

const DEFAULT_BASE_URL = "https://analytics.wcx.cloud";
const DEFAULT_COMPANY = "Me599";
const DEFAULT_TAB_GUID = "8c2f22668de84a57892eab5b1f2c5fd5";
const REQUEST_TIMEOUT_MS = 20_000;

export interface WiseAnalyticsWidgetSeries {
  field: string;
  label?: string;
  type?: string;
}

export interface WiseAnalyticsWidgetConfig {
  series?: WiseAnalyticsWidgetSeries[];
  dataSource?: string;
  metric?: string | null;
  groupBy?: string | null;
  orderBy?: string;
  dimensions?: { field: string; type?: string }[];
  pageSize?: number;
  pageNumber?: number;
  othersFilters?: unknown[];
  autorefresh?: string;
  [key: string]: unknown;
}

export interface WiseAnalyticsWidget {
  id: number;
  title: string;
  wql: string;
  type: number;
  graphicType: number;
  config: WiseAnalyticsWidgetConfig;
}

export interface WiseAnalyticsTab {
  id: number;
  title: string;
  public_link?: string;
  widgets: WiseAnalyticsWidget[];
}

export interface WiseAnalyticsGroup {
  id: number;
  name: string;
}

export interface WiseAnalyticsAgent {
  id: number;
  name: string;
}

export interface WiseAnalyticsPage {
  tab: WiseAnalyticsTab | null;
  groups: WiseAnalyticsGroup[];
  agents: WiseAnalyticsAgent[];
}

/** Envelope interno de Analytics: `d` es un JSON serializado. */
interface WiseAnalyticsEnvelope<T> {
  status: string;
  code: string;
  data: T;
}

export interface WiseAnalyticsReportValues {
  codeCompany: string;
  tab_guid: string;
  wqlPublic: string;
}

function getEnv(key: string): string {
  const runtime = process.env[key];
  if (runtime && typeof runtime === "string") return runtime;

  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as Record<string, unknown>)[key];
    if (val && typeof val === "string") return val;
  }
  return "";
}

export function getAnalyticsBaseUrl(): string {
  const raw = getEnv("WISE_CX_ANALYTICS_BASE_URL") || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

export function getAnalyticsCompany(): string {
  return getEnv("WISE_CX_ANALYTICS_COMPANY") || DEFAULT_COMPANY;
}

export function getAnalyticsTabGuid(): string {
  return getEnv("WISE_CX_ANALYTICS_TAB_GUID") || DEFAULT_TAB_GUID;
}

/** Valores de contexto que se envían en cada consulta de un widget. */
export function buildReportValues(
  overrides?: Partial<WiseAnalyticsReportValues>,
): WiseAnalyticsReportValues {
  return {
    codeCompany: getAnalyticsCompany(),
    tab_guid: getAnalyticsTabGuid(),
    wqlPublic: "",
    ...overrides,
  };
}

async function postAnalytics<T>(
  path: string,
  body: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<InvgateResult<T>> {
  const url = `${getAnalyticsBaseUrl()}/Reports.svc/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Referer: `${getAnalyticsBaseUrl()}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `[Wise Analytics] HTTP ${response.status}: ${response.statusText} (${path})`,
      };
    }

    const raw = (await response.json()) as { d?: string };
    if (typeof raw?.d !== "string") {
      return {
        ok: false,
        status: response.status,
        message: `[Wise Analytics] Respuesta sin payload en ${path}.`,
      };
    }

    let envelope: WiseAnalyticsEnvelope<T>;
    try {
      envelope = JSON.parse(raw.d) as WiseAnalyticsEnvelope<T>;
    } catch {
      return {
        ok: false,
        status: response.status,
        message: `[Wise Analytics] Payload ilegible en ${path}.`,
      };
    }

    if (envelope?.status !== "200") {
      const detail =
        typeof envelope?.data === "string"
          ? envelope.data
          : `code=${envelope?.code ?? "?"}`;
      return {
        ok: false,
        status: response.status,
        message: `[Wise Analytics] ${path} respondió ${envelope?.status ?? "?"} (${detail}).`,
      };
    }

    return { ok: true, status: response.status, data: envelope.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return {
      ok: false,
      status: 0,
      message: `[Wise Analytics] Error de red en ${path}: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

interface RawAnalyticsPage {
  tabs?: WiseAnalyticsTab[];
  groups?: Record<string, number>;
  agents?: Record<string, number>;
}

/**
 * Carga el tab público completo: widgets + catálogos de grupos y agentes.
 * Es la única fuente de los grupos de Wise (el endpoint de widgets no los
 * expone en la respuesta).
 */
export async function loadAnalyticsPage(
  options?: { forceRefresh?: boolean },
): Promise<InvgateResult<WiseAnalyticsPage>> {
  const result = await postAnalytics<RawAnalyticsPage>("LoadPage", {
    reportValues: buildReportValues(),
  });

  if (!result.ok) return result;

  const data = result.data;
  const tab = data?.tabs?.[0] ?? null;

  const groups: WiseAnalyticsGroup[] = Object.entries(data?.groups ?? {})
    .map(([name, id]) => ({ id: Number(id), name }))
    .filter((group) => Number.isFinite(group.id) && group.name !== "[Sin Asignar]")
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const agents: WiseAnalyticsAgent[] = Object.entries(data?.agents ?? {})
    .map(([name, id]) => ({ id: Number(id), name }))
    .filter((agent) => Number.isFinite(agent.id));

  return { ok: true, status: result.status, data: { tab, groups, agents } };
}

export interface WiseWidgetDataResult<T> {
  total: number;
  list: T[];
}

/** Datos agregados de un widget (KPIs, series, agrupamientos). */
export async function getWidgetData<T>(params: {
  widgetType: number;
  widgetId: number;
  widget: unknown;
  reportValues?: Partial<WiseAnalyticsReportValues>;
}): Promise<InvgateResult<WiseWidgetDataResult<T>>> {
  const result = await postAnalytics<WiseWidgetDataResult<T> | null>(
    "getDataReportByWidget",
    {
      widgetType: params.widgetType,
      widgetID: params.widgetId,
      widget: params.widget,
      reportValues: buildReportValues(params.reportValues),
    },
  );

  if (!result.ok) return result;
  // Un WQL inválido devuelve data: null sin error de envelope.
  if (!result.data) {
    return {
      ok: false,
      status: result.status,
      message: "[Wise Analytics] El widget no devolvió datos (WQL o widget inválido).",
    };
  }

  return { ok: true, status: result.status, data: result.data };
}

/** Detalle fila por fila (llamadas, agentes, etc.). */
export async function getCallsListData<T>(params: {
  widgetId: number;
  page?: number;
  widget: unknown;
  reportValues?: Partial<WiseAnalyticsReportValues>;
}): Promise<InvgateResult<WiseWidgetDataResult<T>>> {
  const result = await postAnalytics<WiseWidgetDataResult<T> | null>(
    "getCallsListData",
    {
      widgetID: params.widgetId,
      page: params.page ?? 1,
      widget: params.widget,
      reportValues: buildReportValues(params.reportValues),
      getTotals: false,
    },
  );

  if (!result.ok) return result;
  if (!result.data) {
    return {
      ok: false,
      status: result.status,
      message: "[Wise Analytics] El detalle no devolvió datos (WQL o widget inválido).",
    };
  }

  return { ok: true, status: result.status, data: result.data };
}
