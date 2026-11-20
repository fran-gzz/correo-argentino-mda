import type { APIRoute } from "astro";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { getWiseCallsSnapshot } from "@/lib/wise-cx-calls";
import { getCasosAutogestion } from "@/lib/invgate/casosAutogestion";
import type { CasosAutogestionResumen } from "@/lib/invgate/casosAutogestion";
import { getCalidadResumenTv } from "@/lib/calidad/resumenTv";
import type { CalidadResumenTv } from "@/lib/calidad/resumenTv";

/**
 * GET /api/tv/estado
 *
 * Snapshot del wallboard: KPIs y detalle de llamadas en vivo (Wise CX), la
 * cola de la mesa (InvGate, solo lectura) con sus métricas, y el resumen de
 * calidad con el ranking completo de operadores.
 *
 * Caches: Wise 10 s, casos de InvGate 60 s, calidad 5 min.
 */
export const GET: APIRoute = async ({ locals }) => {
  const denied = await requireReadAccess(locals, "tv");
  if (denied) return denied;

  try {
    const emptyCasos: CasosAutogestionResumen = {
      helpdeskId: 0,
      helpdeskExplicit: false,
      total: 0,
      porCategoria: [],
      casos: [],
      metricas: {
        abiertos: 0,
        sinAsignar: 0,
        asignados: 0,
        porEstado: [],
        antiguedadMedianaHoras: 0,
        masAntiguoHoras: 0,
      },
      actualizadoAt: new Date().toISOString(),
    };

    const emptyCalidad: CalidadResumenTv = {
      month: "",
      monthLabel: "",
      requestedMonth: "",
      usedFallback: false,
      totalAuditorias: 0,
      operadoresAuditados: 0,
      promedioGeneral: null,
      aprobados: 0,
      aprobadosTotal: 0,
      porCanal: [],
      ranking: [],
      actualizadoAt: new Date().toISOString(),
    };

    const [snapshot, casos, calidad] = await Promise.all([
      getWiseCallsSnapshot(),
      getCasosAutogestion().catch((error) => ({
        ...emptyCasos,
        warning: sanitizeError(error),
      })),
      getCalidadResumenTv().catch((error) => {
        console.error(
          "[TV] No se pudo calcular el resumen de calidad:",
          error,
        );
        return emptyCalidad;
      }),
    ]);

    return jsonResponse(
      {
        kpis: snapshot.kpis,
        calls: snapshot.calls,
        fetchedAt: snapshot.fetchedAt,
        stale: snapshot.stale,
        warning: snapshot.warning,
        casos,
        calidad,
      },
      200,
      "no-store",
    );
  } catch (error) {
    return jsonError(sanitizeError(error), 500, "no-store");
  }
};
