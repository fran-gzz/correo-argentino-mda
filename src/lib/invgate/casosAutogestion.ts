/**
 * Casos de autogestión de InvGate — SOLO LECTURA.
 *
 * Trae los casos de la mesa AGS que están en las categorías que la mesa
 * considera "entrantes":
 *
 *  - `1127` "Nueva Solicitud"                 -> caso nuevo que llega a la mesa.
 *  - `2591` "Solicitudes rechazadas en revisión" -> volvió a la cola para
 *    reasignarse (es la categoría que usa la regla P1 del motor).
 *
 * Solo lista casos SIN agente asignado: son los que la mesa todavia tiene que
 * tomar. Descarta tambien los ya resueltos/cerrados. No escribe nada: ni en
 * InvGate ni en SQLite. Es un listado para el wallboard `/broadcast`.
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
import { AGS_HELPDESK_ID } from "@/lib/invgate/agsHelpdesk";

/** "Nueva Solicitud" en InvGate. */
export const CATEGORIA_NUEVA_SOLICITUD = 1127;
/** "Solicitudes rechazadas en revisión" en InvGate. */
export const CATEGORIA_RECHAZADAS = 2591;

const DEFAULT_CATEGORIES = [CATEGORIA_NUEVA_SOLICITUD, CATEGORIA_RECHAZADAS];
const CACHE_TTL_MS = 60_000;

export type CasoAutogestionKey = "nueva_solicitud" | "rechazada";

const CATEGORY_META: Record<
  number,
  { key: CasoAutogestionKey; label: string }
> = {
  [CATEGORIA_NUEVA_SOLICITUD]: { key: "nueva_solicitud", label: "Nueva solicitud" },
  [CATEGORIA_RECHAZADAS]: { key: "rechazada", label: "Rechazadas en revisión" },
};

export interface CasoAutogestion {
  id: number;
  prettyId: string;
  title: string;
  categoryId: number;
  categoryName: string;
  categoryLabel: string;
  categoryKey: CasoAutogestionKey;
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

export interface CasosAutogestionResumen {
  helpdeskId: number;
  total: number;
  porCategoria: { key: CasoAutogestionKey; label: string; count: number }[];
  casos: CasoAutogestion[];
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
 * Mesa a consultar. Por defecto la de autogestiones (`INVGATE_AGENTS_HELPDESK_ID`).
 * Se puede apuntar a otra sin tocar el resto del flujo con
 * `INVGATE_AUTOGESTION_HELPDESK_ID` (útil para probar contra producción desde
 * un entorno que cae al fallback de QA).
 */
export function getAutogestionHelpdeskId(): number {
  const raw = getEnv("INVGATE_AUTOGESTION_HELPDESK_ID");
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : AGS_HELPDESK_ID;
}

/** Categorías a listar: `INVGATE_AUTOGESTION_CATEGORY_IDS="1127,2591"`. */
export function getAutogestionCategoryIds(): number[] {
  const raw = getEnv("INVGATE_AUTOGESTION_CATEGORY_IDS");
  if (!raw) return DEFAULT_CATEGORIES;

  const parsed = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  return parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
}

function emptyResumen(
  helpdeskId: number,
  categories: number[],
  warning?: string,
): CasosAutogestionResumen {
  return {
    helpdeskId,
    total: 0,
    porCategoria: categories.map((id) => ({
      key: CATEGORY_META[id]?.key ?? "nueva_solicitud",
      label: CATEGORY_META[id]?.label ?? `Categoría ${id}`,
      count: 0,
    })),
    casos: [],
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

async function buildResumen(): Promise<CasosAutogestionResumen> {
  const helpdeskId = getAutogestionHelpdeskId();
  const categories = getAutogestionCategoryIds();
  const categorySet = new Set(categories);

  const idsResult = await getIncidentIdsByHelpdesk(helpdeskId);
  if (!idsResult.ok) {
    return emptyResumen(helpdeskId, categories, idsResult.message);
  }
  if (idsResult.data.length === 0) {
    return emptyResumen(helpdeskId, categories);
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
    return emptyResumen(helpdeskId, categories, incidentsResult.message);
  }

  const statusNameById = new Map<number, string>(
    statuses.ok ? statuses.data.map((status) => [status.id, status.name]) : [],
  );

  const now = Math.floor(Date.now() / 1000);
  const casos: CasoAutogestion[] = [];

  for (const incident of Object.values(incidentsResult.data)) {
    if (!categorySet.has(incident.category_id)) continue;
    // Solo casos abiertos: los resueltos/cerrados no son accionables.
    if (incident.solved_at || incident.closed_at) continue;
    // Solo los que todavía no tienen agente: son los que la mesa debe tomar.
    if (incident.assigned_id) continue;

    const categoryName = categoryMap.get(incident.category_id) ?? "";
    const meta = CATEGORY_META[incident.category_id];

    casos.push({
      id: incident.id,
      prettyId: incident.pretty_id,
      title: incident.title,
      categoryId: incident.category_id,
      categoryName: getLastCategoryName(categoryName) || categoryName,
      categoryLabel: meta?.label ?? categoryName,
      categoryKey: meta?.key ?? "nueva_solicitud",
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

  const porCategoria = categories.map((id) => ({
    key: CATEGORY_META[id]?.key ?? "nueva_solicitud",
    label: CATEGORY_META[id]?.label ?? `Categoría ${id}`,
    count: casos.filter((caso) => caso.categoryId === id).length,
  }));

  return {
    helpdeskId,
    total: casos.length,
    porCategoria,
    casos,
    actualizadoAt: new Date().toISOString(),
  };
}

/**
 * Snapshot de los casos de autogestión. Cache de 60 s + single-flight: el
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
