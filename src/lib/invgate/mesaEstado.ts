/**
 * Estado de la Mesa de Ayuda TI Nivel 1 en InvGate.
 *
 * CONSERVADO SIN USO: la vista `/broadcast` mostro que este dato no suma en
 * un wallboard de TV. Se conserva para una vista de detalle o de reporteria.
 *
 * La API de InvGate NO expone los "tableros" (vistas guardadas): los endpoints
 * `views`, `reports`, `dashboards`, `boards` y `savedviews` no existen
 * (verificado contra la API de producción el 2026-10-21). Lo que sí existe es
 * el estado real de la cola, que es lo que la mesa necesita para saber cómo
 * está trabajando:
 *
 *  - `helpdesksandlevels` -> mesa "TI_GSM_MDA TI" (id 2509) y su Nivel 1
 *    (id 2510, type_id=1, level_order=1).
 *  - `incidents.by.helpdesk?helpdesk_id=2510` -> ids de los casos de la cola.
 *  - `incidents?ids[]=...` -> detalle de cada caso (estado, asignado, fecha).
 *  - `incident.attributes.status` -> nombres de estado.
 *  - `users` -> agentes con email (para mostrar a quién le corresponde cada caso).
 */

import { getIncidentIdsByHelpdesk } from "@/lib/invgate/automation/by-helpdesk";
import { getIncidents } from "@/lib/invgate/automation/incidents";
import { getIncidentStatuses } from "@/lib/invgate/automation/statuses";
import { getHelpdesksAndLevels } from "@/lib/invgate/automation/helpdesks";
import { getFullUserMap } from "@/lib/invgate/userCache";
import type { InvgateUser } from "@/types/invgate";

/** Nivel 1 de "TI_GSM_MDA TI" (verificado contra InvGate prod 2026-10-21). */
export const MESA_TI_NIVEL_1_ID = 2510;

const CACHE_TTL_MS = 120_000;
/** Tope de casos analizados por snapshot (la cola tiene cientos). */
const MAX_CASES = 400;

export interface MesaCaso {
  id: number;
  prettyId: string;
  title: string;
  statusId: number;
  statusName: string;
  assignedId: number | null;
  assignedName: string | null;
  assignedEmail: string | null;
  /** Epoch (segundos) de creación del caso. */
  createdAt: number;
  /** Horas desde la creación. */
  ageHours: number;
  solved: boolean;
}

export interface MesaAgenteResumen {
  id: number;
  nombre: string;
  email: string | null;
  casos: number;
  abiertos: number;
}

export interface MesaEstadoResumen {
  helpdeskId: number;
  helpdeskName: string;
  nivelNombre: string;
  total: number;
  abiertos: number;
  resueltos: number;
  /** Casos sin agente asignado. */
  sinAsignar: number;
  porEstado: { statusId: number; name: string; count: number }[];
  porAgente: MesaAgenteResumen[];
  casos: MesaCaso[];
  actualizadoAt: string;
  stale: boolean;
  warning?: string;
}

interface CacheEntry {
  data: MesaEstadoResumen;
  timestamp: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<MesaEstadoResumen> | null = null;

function normalizeEmail(user: InvgateUser): string | null {
  const email = (user.email || user.other_email || "").trim();
  return email.length > 0 ? email : null;
}

function buildUserIndex(users: Map<number, InvgateUser>) {
  const byId = new Map<number, { nombre: string; email: string | null }>();
  for (const [id, user] of users) {
    const nombre =
      `${user.name || ""} ${user.lastname || ""}`.trim() ||
      user.username ||
      `Usuario #${id}`;
    byId.set(id, { nombre, email: normalizeEmail(user) });
  }
  return byId;
}

async function resolveMesaLabels(
  levelId: number,
): Promise<{ helpdeskName: string; nivelNombre: string }> {
  const result = await getHelpdesksAndLevels();
  if (!result.ok) {
    return { helpdeskName: `Mesa ${levelId}`, nivelNombre: "Nivel 1" };
  }

  const level = result.data.find((node) => node.id === levelId);
  if (!level) {
    return { helpdeskName: `Mesa ${levelId}`, nivelNombre: "Nivel 1" };
  }

  const parent = result.data.find((node) => node.id === level.parent_id);
  return {
    helpdeskName: parent?.name ?? `Mesa ${level.parent_id ?? levelId}`,
    nivelNombre: level.level_order ? `Nivel ${level.level_order}` : "Nivel 1",
  };
}

async function buildSnapshot(): Promise<MesaEstadoResumen> {
  const levelId = MESA_TI_NIVEL_1_ID;

  const [idsResult, statusesResult, users, labels] = await Promise.all([
    getIncidentIdsByHelpdesk(levelId),
    getIncidentStatuses(),
    getFullUserMap(),
    resolveMesaLabels(levelId),
  ]);

  if (!idsResult.ok) {
    return {
      helpdeskId: levelId,
      helpdeskName: labels.helpdeskName,
      nivelNombre: labels.nivelNombre,
      total: 0,
      abiertos: 0,
      resueltos: 0,
      sinAsignar: 0,
      porEstado: [],
      porAgente: [],
      casos: [],
      actualizadoAt: new Date().toISOString(),
      stale: true,
      warning: idsResult.message,
    };
  }

  const statusNameById = new Map<number, string>();
  if (statusesResult.ok) {
    for (const status of statusesResult.data) {
      statusNameById.set(status.id, status.name);
    }
  }

  const userIndex = buildUserIndex(users);
  const ids = idsResult.data.slice(0, MAX_CASES);
  const incidentsResult = await getIncidents(ids);

  const now = Math.floor(Date.now() / 1000);
  const casos: MesaCaso[] = [];
  const estadoCount = new Map<number, number>();
  const agenteCount = new Map<number, { casos: number; abiertos: number }>();

  if (incidentsResult.ok) {
    for (const incident of Object.values(incidentsResult.data)) {
      const solved = Boolean(incident.solved_at);
      const assigned = incident.assigned_id ?? null;
      const user = assigned !== null ? userIndex.get(assigned) : undefined;

      casos.push({
        id: incident.id,
        prettyId: incident.pretty_id,
        title: incident.title,
        statusId: incident.status_id,
        statusName:
          statusNameById.get(incident.status_id) ??
          `Estado ${incident.status_id}`,
        assignedId: assigned,
        assignedName: user?.nombre ?? null,
        assignedEmail: user?.email ?? null,
        createdAt: incident.created_at,
        ageHours: Math.max(
          0,
          Math.round(((now - incident.created_at) / 3600) * 10) / 10,
        ),
        solved,
      });

      estadoCount.set(
        incident.status_id,
        (estadoCount.get(incident.status_id) ?? 0) + 1,
      );

      const key = assigned ?? -1;
      const current = agenteCount.get(key) ?? { casos: 0, abiertos: 0 };
      current.casos += 1;
      if (!solved) current.abiertos += 1;
      agenteCount.set(key, current);
    }
  }

  casos.sort((a, b) => b.createdAt - a.createdAt);

  const porEstado = Array.from(estadoCount.entries())
    .map(([statusId, count]) => ({
      statusId,
      name: statusNameById.get(statusId) ?? `Estado ${statusId}`,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const porAgente: MesaAgenteResumen[] = Array.from(agenteCount.entries())
    .map(([key, value]) => {
      if (key === -1) {
        return {
          id: -1,
          nombre: "[Sin Asignar]",
          email: null,
          casos: value.casos,
          abiertos: value.abiertos,
        };
      }
      const user = userIndex.get(key);
      return {
        id: key,
        nombre: user?.nombre ?? `Usuario #${key}`,
        email: user?.email ?? null,
        casos: value.casos,
        abiertos: value.abiertos,
      };
    })
    .sort((a, b) => b.abiertos - a.abiertos || b.casos - a.casos);

  const solvedCount = casos.filter((caso) => caso.solved).length;

  return {
    helpdeskId: levelId,
    helpdeskName: labels.helpdeskName,
    nivelNombre: labels.nivelNombre,
    total: idsResult.data.length,
    abiertos: casos.length - solvedCount,
    resueltos: solvedCount,
    sinAsignar: porAgente.find((agente) => agente.id === -1)?.casos ?? 0,
    porEstado,
    porAgente,
    casos,
    actualizadoAt: new Date().toISOString(),
    stale: false,
    warning: incidentsResult.ok
      ? undefined
      : incidentsResult.message,
  };
}

/**
 * Snapshot del estado de la Mesa de Ayuda TI Nivel 1.
 * Cache de 2 minutos + single-flight.
 */
export async function getMesaEstadoResumen(
  options: { forceRefresh?: boolean } = {},
): Promise<MesaEstadoResumen> {
  const now = Date.now();
  if (!options.forceRefresh) {
    if (cache && now - cache.timestamp < CACHE_TTL_MS) return cache.data;
    if (inFlight) return inFlight;
  }

  const promise = (async () => {
    const data = await buildSnapshot();
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
