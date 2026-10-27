/**
 * Resumen de calidad para el wallboard `/broadcast`.
 *
 * Solo lectura. Reusa las funciones de cálculo del módulo de calidad para que
 * la TV y la página `/supervision/calidad-operadores` no muestren números
 * distintos:
 *  - score por operador: `calculateOperatorChannelStats().globalAverage`
 *    (promedio de los promedios de canal, igual que la UI de calidad).
 *  - promedios por canal: `calculateChannelAverages()`.
 *
 * Fallback de período: si el mes corriente tiene menos de
 * `MIN_AUDITS_FOR_CURRENT` auditorías, se usa el mes anterior (un ranking con
 * 2 auditorías no dice nada). El resumen indica qué mes terminó usando.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db/index";
import { agents, qualityAudits, users } from "@/db/schema";
import { activeAgentCondition } from "@/lib/activeUsers";
import {
  calculateChannelAverages,
  calculateOperatorChannelStats,
} from "@/lib/qualityCalculator";
import { formatMonthLabel } from "@/lib/monthUtils";

/** Debajo de esta cantidad de auditorías, el mes corriente no es representativo. */
const MIN_AUDITS_FOR_CURRENT = 5;
const CACHE_TTL_MS = 5 * 60_000;
/** Umbral de aprobación, el mismo que usa el Excel de calidad. */
const APPROVAL_THRESHOLD = 75;
const TOP_SIZE = 3;

export interface CalidadTopOperador {
  agentId: number;
  name: string;
  /** Promedio de promedios de canal (0-100). */
  score: number;
  audits: number;
  /** true si cumplió la cuota mensual (4 llamadas + 4 mails + 4 AG). */
  quotaFulfilled: boolean;
}

export interface CalidadCanalPromedio {
  key: "wise_call" | "wise_email" | "invgate_ticket";
  label: string;
  /** null cuando no hubo auditorías de ese canal. */
  avg: number | null;
  count: number;
}

export interface CalidadResumenBroadcast {
  /** Mes usado en el resumen (`MM-YYYY`). */
  month: string;
  monthLabel: string;
  /** Mes corriente solicitado (`MM-YYYY`). */
  requestedMonth: string;
  /** true si el corriente no tenía datos suficientes y se usó el anterior. */
  usedFallback: boolean;
  totalAuditorias: number;
  operadoresAuditados: number;
  /** Media de los promedios por operador (criterio del Excel "Promedio MDA"). */
  promedioGeneral: number | null;
  /** Operadores con promedio >= 75. */
  aprobados: number;
  aprobadosTotal: number;
  porCanal: CalidadCanalPromedio[];
  top: CalidadTopOperador[];
  actualizadoAt: string;
}

interface CacheEntry {
  data: CalidadResumenBroadcast;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CalidadResumenBroadcast>>();

function currentMonth(now: Date = new Date()): string {
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  return `${mm}-${now.getFullYear()}`;
}

function previousMonth(now: Date = new Date()): string {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mm = (prev.getMonth() + 1).toString().padStart(2, "0");
  return `${mm}-${prev.getFullYear()}`;
}

interface MonthAggregate {
  total: number;
  byAgent: Map<number, { name: string; audits: { channelType: string; totalScore: number }[] }>;
  channelRows: { channelType: string; totalScore: number }[];
}

async function loadMonth(month: string): Promise<MonthAggregate> {
  const rows = await db
    .select({
      agentId: qualityAudits.agentId,
      name: agents.name,
      channelType: qualityAudits.channelType,
      totalScore: qualityAudits.totalScore,
    })
    .from(qualityAudits)
    .innerJoin(agents, eq(agents.id, qualityAudits.agentId))
    .leftJoin(users, eq(users.id, agents.userId))
    .where(
      and(
        eq(qualityAudits.month, month),
        eq(agents.incluidoCalidad, true),
        activeAgentCondition(),
      ),
    );

  const byAgent: MonthAggregate["byAgent"] = new Map();
  const channelRows: MonthAggregate["channelRows"] = [];

  for (const row of rows) {
    const entry = byAgent.get(row.agentId) ?? { name: row.name, audits: [] };
    entry.audits.push({
      channelType: row.channelType,
      totalScore: row.totalScore,
    });
    byAgent.set(row.agentId, entry);

    channelRows.push({
      channelType: row.channelType,
      totalScore: row.totalScore,
    });
  }

  return { total: rows.length, byAgent, channelRows };
}

function buildResumen(
  month: string,
  requestedMonth: string,
  usedFallback: boolean,
  aggregate: MonthAggregate,
): CalidadResumenBroadcast {
  const operadores = [...aggregate.byAgent.entries()].map(([agentId, entry]) => {
    const stats = calculateOperatorChannelStats(entry.audits);
    return {
      agentId,
      name: entry.name,
      score: stats.globalAverage,
      audits: entry.audits.length,
      quotaFulfilled: stats.quotaFulfilled,
    } satisfies CalidadTopOperador;
  });

  const top = operadores
    .filter((operador) => operador.audits > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.audits - a.audits ||
        a.name.localeCompare(b.name, "es"),
    )
    .slice(0, TOP_SIZE);

  const conAuditorias = operadores.filter((operador) => operador.audits > 0);
  const promedioGeneral =
    conAuditorias.length > 0
      ? Math.round(
          conAuditorias.reduce((acc, operador) => acc + operador.score, 0) /
            conAuditorias.length,
        )
      : null;

  const canales = calculateChannelAverages(aggregate.channelRows);
  const porCanal: CalidadCanalPromedio[] = [
    {
      key: "wise_call",
      label: "Llamadas",
      avg: canales.wiseCallsAvg,
      count: canales.wiseCallsCount,
    },
    {
      key: "wise_email",
      label: "Mails",
      avg: canales.wiseEmailsAvg,
      count: canales.wiseEmailsCount,
    },
    {
      key: "invgate_ticket",
      label: "Autogestiones",
      avg: canales.invgateTicketAvg,
      count: canales.invgateTicketCount,
    },
  ];

  const aprobados = conAuditorias.filter(
    (operador) => operador.score >= APPROVAL_THRESHOLD,
  ).length;

  return {
    month,
    monthLabel: formatMonthLabel(month),
    requestedMonth,
    usedFallback,
    totalAuditorias: aggregate.total,
    operadoresAuditados: conAuditorias.length,
    promedioGeneral,
    aprobados,
    aprobadosTotal: conAuditorias.length,
    porCanal,
    top,
    actualizadoAt: new Date().toISOString(),
  };
}

async function buildResumenWithFallback(
  now: Date = new Date(),
): Promise<CalidadResumenBroadcast> {
  const requested = currentMonth(now);
  const actual = await loadMonth(requested);

  if (actual.total >= MIN_AUDITS_FOR_CURRENT) {
    return buildResumen(requested, requested, false, actual);
  }

  const previous = previousMonth(now);
  const anterior = await loadMonth(previous);

  if (anterior.total > 0) {
    return buildResumen(previous, requested, true, anterior);
  }

  // Sin datos en ninguno de los dos: se devuelve el corriente vacío.
  return buildResumen(requested, requested, false, actual);
}

/**
 * Resumen de calidad del mes corriente (con fallback al anterior si no hay
 * auditorías suficientes). Cache de 5 min + single-flight.
 */
export async function getCalidadResumenBroadcast(
  options: { forceRefresh?: boolean; now?: Date } = {},
): Promise<CalidadResumenBroadcast> {
  const key = currentMonth(options.now);
  const now = Date.now();

  if (!options.forceRefresh) {
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) return cached.data;
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const promise = (async () => {
    const data = await buildResumenWithFallback(options.now);
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

/** Libera la caché en memoria (tests). */
export function invalidateCalidadResumenCache(): void {
  cache.clear();
}
