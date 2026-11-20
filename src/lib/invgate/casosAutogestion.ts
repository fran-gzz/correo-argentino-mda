/**
 * Casos de la mesa de ayuda en InvGate — SOLO LECTURA.
 *
 * Lista los casos abiertos de la mesa que todavía no tienen agente asignado y
 * calcula las métricas de la cola (abiertos, asignados, por estado y
 * antigüedad). Es la fuente del panel de la mesa en el wallboard `/tv`.
 *
 * No escribe nada: ni en InvGate ni en SQLite.
 *
 * Reusa la misma config de InvGate que el resto del portal (`invgateClient`:
 * `INVGATE_BASE_URL` + `INVGATE_API_KEY`), así que no hay integración nueva.
 */

import { getIncidentIdsByHelpdesk } from "@/lib/invgate/automation/by-helpdesk";
import { getIncidents } from "@/lib/invgate/automation/incidents";
import { getIncidentStatuses } from "@/lib/invgate/automation/statuses";
import { getCategoryMap, getLastCategoryName } from "@/lib/invgate/categoryCache";
import { getFullUserMap } from "@/lib/invgate/userCache";
import { getLocationsMap } from "@/lib/invgate/locationsMapCache";
import { getAgsHelpdeskResolution } from "@/lib/invgate/agsHelpdesk";

const CACHE_TTL_MS = 60_000;
/** Tope de categorías distintas que se devuelven en el desglose. */
const MAX_CATEGORY_BREAKDOWN = 8;

export interface CasoAutogestion {
  id: number;
  prettyId: string;
  title: string;
  categoryId: number;
  /** Último segmento del nombre de la categoría (ej. "Mosaic- Consulta"). */
  categoryName: string;
  statusId: number;
  statusName: string;
  /** Siempre null: el panel lista solo casos sin agente asignado. */
  assignedId: null;
  creatorName: string | null;
  locationName: string | null;
  /** Epoch en segundos (formato de InvGate). */
  createdAt: number;
  /** Horas desde la creación. */
  ageHours: number;
}

export interface MesaEstadoResumen {
  statusId: number;
  name: string;
  count: number;
}

export interface CasosMetricas {
  /** Casos abiertos de la cola (con o sin agente). */
  abiertos: number;
  sinAsignar: number;
  asignados: number;
  /** Desglose por estado, de mayor a menor cantidad. */
  porEstado: MesaEstadoResumen[];
  /** Mediana de antigüedad de los casos abiertos, en horas. */
  antiguedadMedianaHoras: number;
  /** Antigüedad del caso abierto más viejo, en horas. */
  masAntiguoHoras: number;
}

export interface CasosAutogestionResumen {
  helpdeskId: number;
  /** false cuando el ID se resolvió por default y no por variable de entorno. */
  helpdeskExplicit: boolean;
  total: number;
  /** Desglose por categoría real, de mayor a menor cantidad. */
  porCategoria: { categoryId: number; label: string; count: number }[];
  casos: CasoAutogestion[];
  metricas: CasosMetricas;
  actualizadoAt: string;
  warning?: string;
}

interface CacheEntry {
  data: CasosAutogestionResumen;
  timestamp: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<CasosAutogestionResumen> | null = null;

function getEnv(key: string): string {
  const runtime = process.env[key];
  if (runtime && typeof runtime === "string") return runtime;

  if (typeof import.meta !== "undefined" && import.meta.env) {
    const val = (import.meta.env as Record<string, unknown>)[key];
    if (val && typeof val === "string") return val;
  }
  return "";
}

/**
 * Mesa a consultar. Por defecto la del flujo de asignación
 * (`INVGATE_AGENTS_HELPDESK_ID`). Se puede apuntar a otra sin tocar el resto
 * con `INVGATE_AUTOGESTION_HELPDESK_ID`.
 *
 * `explicit` distingue una mesa configurada a mano de un default: solo en el
 * segundo caso un cero amerita un aviso, porque puede ser el ID equivocado.
 */
export function getAutogestionHelpdeskResolution(): {
  id: number;
  explicit: boolean;
  source: "env" | "ags";
} {
  const raw = getEnv("INVGATE_AUTOGESTION_HELPDESK_ID");
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return { id: parsed, explicit: true, source: "env" };
  }

  const ags = getAgsHelpdeskResolution();
  return { id: ags.id, explicit: ags.explicit, source: "ags" };
}

export function getAutogestionHelpdeskId(): number {
  return getAutogestionHelpdeskResolution().id;
}

function emptyMetricas(): CasosMetricas {
  return {
    abiertos: 0,
    sinAsignar: 0,
    asignados: 0,
    porEstado: [],
    antiguedadMedianaHoras: 0,
    masAntiguoHoras: 0,
  };
}

function emptyResumen(
  helpdeskId: number,
  helpdeskExplicit: boolean,
  warning?: string,
): CasosAutogestionResumen {
  return {
    helpdeskId,
    helpdeskExplicit,
    total: 0,
    porCategoria: [],
    casos: [],
    metricas: emptyMetricas(),
    actualizadoAt: new Date().toISOString(),
    warning,
  };
}

function displayName(
  user: { name?: string | null; lastname?: string | null; username?: string | null } | undefined,
  fallbackId: number | null,
): string | null {
  if (!user) return fallbackId ? `Usuario #${fallbackId}` : null;
  return (
    `${user.name || ""} ${user.lastname || ""}`.trim() ||
    user.username ||
    (fallbackId ? `Usuario #${fallbackId}` : null)
  );
}

/** Mediana de una lista de números; 0 si está vacía. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return Math.round(value * 10) / 10;
}

async function buildResumen(): Promise<CasosAutogestionResumen> {
  const resolution = getAutogestionHelpdeskResolution();
  const helpdeskId = resolution.id;

  const idsResult = await getIncidentIdsByHelpdesk(helpdeskId);
  if (!idsResult.ok) {
    return emptyResumen(helpdeskId, resolution.explicit, idsResult.message);
  }
  if (idsResult.data.length === 0) {
    // Una cola vacía es válida si la mesa se configuró explícitamente. Si el
    // ID salió de un default, un cero suele significar que apunta a otra mesa
    // (o a QA) y el panel lo tiene que decir, no mostrar 0 como si fuera dato.
    const warning = resolution.explicit
      ? undefined
      : `La mesa ${helpdeskId} no devolvió casos. Revisá INVGATE_AGENTS_HELPDESK_ID: el valor por default puede no ser el de esta instalación.`;
    return emptyResumen(helpdeskId, resolution.explicit, warning);
  }

  const [incidentsResult, categoryMap, statuses, users, locations] =
    await Promise.all([
      getIncidents(idsResult.data),
      getCategoryMap(),
      getIncidentStatuses(),
      getFullUserMap(),
      getLocationsMap(),
    ]);

  if (!incidentsResult.ok) {
    return emptyResumen(helpdeskId, resolution.explicit, incidentsResult.message);
  }

  const statusNameById = new Map<number, string>(
    statuses.ok ? statuses.data.map((status) => [status.id, status.name]) : [],
  );

  const now = Math.floor(Date.now() / 1000);
  const casos: CasoAutogestion[] = [];
  const abiertos = Object.values(incidentsResult.data).filter(
    (incident) => !incident.solved_at && !incident.closed_at,
  );

  const statusCount = new Map<number, number>();
  const ages: number[] = [];

  for (const incident of abiertos) {
    statusCount.set(
      incident.status_id,
      (statusCount.get(incident.status_id) ?? 0) + 1,
    );
    ages.push((now - incident.created_at) / 3600);

    // Solo los que todavía no tienen agente: son los que la mesa debe tomar.
    if (incident.assigned_id) continue;

    const categoryName = categoryMap.get(incident.category_id) ?? "";

    casos.push({
      id: incident.id,
      prettyId: incident.pretty_id,
      title: incident.title,
      categoryId: incident.category_id,
      categoryName:
        getLastCategoryName(categoryName) ||
        categoryName ||
        `Categoría ${incident.category_id}`,
      statusId: incident.status_id,
      statusName:
        statusNameById.get(incident.status_id) ?? `Estado ${incident.status_id}`,
      assignedId: null,
      creatorName: displayName(
        incident.creator_id ? users.get(incident.creator_id) : undefined,
        incident.creator_id ?? null,
      ),
      locationName: incident.location_id
        ? (locations.get(incident.location_id) ?? `Ubicación #${incident.location_id}`)
        : null,
      createdAt: incident.created_at,
      ageHours: Math.max(
        0,
        Math.round(((now - incident.created_at) / 3600) * 10) / 10,
      ),
    });
  }

  // Los mas viejos primero: son los que llevan mas tiempo esperando.
  casos.sort((a, b) => a.createdAt - b.createdAt);

  const counts = new Map<number, number>();
  for (const caso of casos) {
    counts.set(caso.categoryId, (counts.get(caso.categoryId) ?? 0) + 1);
  }

  const porCategoria = Array.from(counts.entries())
    .map(([categoryId, count]) => {
      const label =
        casos.find((caso) => caso.categoryId === categoryId)?.categoryName ??
        `Categoría ${categoryId}`;
      return { categoryId, label, count };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"))
    .slice(0, MAX_CATEGORY_BREAKDOWN);

  const porEstado: MesaEstadoResumen[] = Array.from(statusCount.entries())
    .map(([statusId, count]) => ({
      statusId,
      name: statusNameById.get(statusId) ?? `Estado ${statusId}`,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));

  return {
    helpdeskId,
    helpdeskExplicit: resolution.explicit,
    total: casos.length,
    porCategoria,
    casos,
    metricas: {
      abiertos: abiertos.length,
      sinAsignar: casos.length,
      asignados: Math.max(0, abiertos.length - casos.length),
      porEstado,
      antiguedadMedianaHoras: median(ages),
      masAntiguoHoras: ages.length > 0 ? Math.round(Math.max(...ages) * 10) / 10 : 0,
    },
    actualizadoAt: new Date().toISOString(),
  };
}

/**
 * Snapshot de los casos de la mesa. Cache de 60 s + single-flight: el
 * wallboard refresca cada 10 s, así que InvGate se consulta una vez por minuto.
 */
export async function getCasosAutogestion(
  options: { forceRefresh?: boolean } = {},
): Promise<CasosAutogestionResumen> {
  const now = Date.now();

  if (!options.forceRefresh) {
    if (cache && now - cache.timestamp < CACHE_TTL_MS) return cache.data;
    if (inFlight) return inFlight;
  }

  const promise = (async () => {
    const data = await buildResumen();
    cache = { data, timestamp: Date.now() };
    return data;
  })();

  inFlight = promise;
  try {
    return await promise;
  } finally {
    inFlight = null;
  }
}

/** Libera la caché en memoria (tests / refresh manual). */
export function invalidateCasosAutogestionCache(): void {
  cache = null;
}
