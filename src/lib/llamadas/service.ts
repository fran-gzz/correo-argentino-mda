/**
 * Agregador de la vista "Llamadas en vivo".
 *
 * CONSERVADO SIN USO: la vista paso a ser `/broadcast` (wallboard de TV) y
 * consume unicamente Wise CX, asi que el endpoint llama directo a
 * `getWiseCallsSnapshot`. Este modulo se conserva (junto con
 * `src/lib/invgate/mesaEstado.ts` y `src/components/invgate/MesaTiEstadoCard.astro`)
 * para una futura vista de detalle: aporta el estado de la Mesa de Ayuda TI
 * Nivel 1 y el cruce agente -> email de InvGate.
 *
 * Cruza dos fuentes:
 *  - Wise CX Analytics: KPIs de llamadas y detalle de las llamadas vivas.
 *  - InvGate: estado de la Mesa de Ayuda TI Nivel 1 + email de los agentes.
 *
 * El cruce Wise -> InvGate es por nombre de agente (son los mismos
 * contactos): se normaliza (minúsculas, sin tildes ni puntuación) y se
 * busca coincidencia exacta o por tokens de nombre+apellido.
 */

import {
  getWiseCallsSnapshot,
  normalizeCallText,
} from "@/lib/wise-cx-calls";
import {
  getMesaEstadoResumen,
  type MesaEstadoResumen,
} from "@/lib/invgate/mesaEstado";
import { getFullUserMap } from "@/lib/invgate/userCache";

export interface LlamadasPanelData {
  kpis: Awaited<ReturnType<typeof getWiseCallsSnapshot>>["kpis"];
  calls: Awaited<ReturnType<typeof getWiseCallsSnapshot>>["calls"];
  groups: Awaited<ReturnType<typeof getWiseCallsSnapshot>>["groups"];
  fetchedAt: string;
  stale: boolean;
  warning?: string;
  mesa: MesaEstadoResumen;
}

/**
 * Índice de agentes de InvGate por nombre normalizado -> email.
 * Se construye con todos los usuarios (no solo los de la mesa) porque Wise
 * reporta llamadas de distintos grupos de la cuenta.
 */
async function buildAgentEmailIndex(): Promise<Map<string, string>> {
  const users = await getFullUserMap();
  const index = new Map<string, string>();

  for (const user of users.values()) {
    const email = (user.email || user.other_email || "").trim();
    if (!email) continue;
    const nombre = `${user.name || ""} ${user.lastname || ""}`.trim();
    if (!nombre) continue;

    const key = normalizeCallText(nombre);
    if (key && !index.has(key)) index.set(key, email);
  }

  return index;
}

function findEmail(
  agentName: string,
  index: Map<string, string>,
): string | null {
  const key = normalizeCallText(agentName);
  if (!key) return null;

  const exact = index.get(key);
  if (exact) return exact;

  // Fallback por tokens: "Matías Joel Chen" vs "Matías Joel Chen." ya queda
  // cubierto por la normalización; acá se cubre "Chen, Matías Joel".
  const tokens = key.split(" ").filter(Boolean);
  if (tokens.length < 2) return null;

  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  for (const [candidate, email] of index) {
    if (
      candidate.startsWith(`${first} `) &&
      candidate.endsWith(` ${last}`)
    ) {
      return email;
    }
  }

  return null;
}

/**
 * Devuelve el estado completo de la vista: llamadas en vivo (Wise) + estado de
 * la mesa (InvGate). El snapshot de Wise se cachea 10 s y el de InvGate 2 min.
 */
export async function getLlamadasPanel(options: {
  groupId?: number | null;
  forceRefresh?: boolean;
} = {}): Promise<LlamadasPanelData> {
  const [snapshot, mesa, agentIndex] = await Promise.all([
    getWiseCallsSnapshot({
      groupId: options.groupId ?? null,
      forceRefresh: options.forceRefresh,
    }),
    getMesaEstadoResumen({ forceRefresh: options.forceRefresh }),
    buildAgentEmailIndex(),
  ]);

  const calls = snapshot.calls.map((call) => ({
    ...call,
    agentEmail: findEmail(call.agentName, agentIndex),
  }));

  return {
    kpis: snapshot.kpis,
    calls,
    groups: snapshot.groups,
    fetchedAt: snapshot.fetchedAt,
    stale: snapshot.stale,
    warning: snapshot.warning,
    mesa,
  };
}
