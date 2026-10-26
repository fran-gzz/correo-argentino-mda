/**
 * Casos de autogestión de InvGate — SOLO LECTURA.
 *
 * Lista todos los casos de la mesa AGS que están **abiertos y sin agente
 * asignado**: son los que la mesa todavía tiene que tomar. No filtra por
 * categoría (a la mesa llegan de cualquier tema) y no incluye los ya
 * resueltos/cerrados.
 *
 * No escribe nada: ni en InvGate ni en SQLite. Es un listado para el
 * wallboard `/broadcast`.
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

export interface CasosAutogestionResumen {
  helpdeskId: number;
  total: number;
  /** Desglose por categoría real, de mayor a menor cantidad. */
  porCategoria: { categoryId: number; label: string; count: number }[];
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

function emptyResumen(
  helpdeskId: number,
  warning?: string,
): CasosAutogestionResumen {
  return {
    helpdeskId,
    total: 0,
    porCategoria: [],
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

  const idsResult = await getIncidentIdsByHelpdesk(helpdeskId);
  if (!idsResult.ok) {
    return emptyResumen(helpdeskId, idsResult.message);
  }
  if (idsResult.data.length === 0) {
    return emptyResumen(helpdeskId);
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
    return emptyResumen(helpdeskId, incidentsResult.message);
  }

  const statusNameById = new Map<number, string>(
    statuses.ok ? statuses.data.map((status) => [status.id, status.name]) : [],
  );

  const now = Math.floor(Date.now() / 1000);
  const casos: CasoAutogestion[] = [];

  for (const incident of Object.values(incidentsResult.data)) {
    // Solo los que todavía no tienen agente: son los que la mesa debe tomar.
    if (incident.assigned_id) continue;
    // Y solo los abiertos: los resueltos/cerrados no son accionables.
    if (incident.solved_at || incident.closed_at) continue;

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

  return {
    helpdeskId,
    total: casos.length,
    porCategoria,
    casos,
    actualizadoAt: new Date().toISOString(),
  };
}

/**
 * Snapshot de los casos de autogestión sin asignar. Cache de 60 s +
 * single-flight: el wallboard refresca cada 10 s, así que InvGate se consulta
 * una vez por minuto.
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
