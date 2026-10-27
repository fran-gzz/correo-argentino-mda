import type { APIRoute } from "astro";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { getWiseCallsSnapshot } from "@/lib/wise-cx-calls";
import { getCasosAutogestion } from "@/lib/invgate/casosAutogestion";
import type { CasosAutogestionResumen } from "@/lib/invgate/casosAutogestion";
import { getCalidadResumenBroadcast } from "@/lib/calidad/broadcastResumen";
import type { CalidadResumenBroadcast } from "@/lib/calidad/broadcastResumen";

/**
 * GET /api/broadcast/estado
 *
 * Snapshot del wallboard: KPIs y detalle de llamadas en vivo (Wise CX) + los
 * casos de autogestión de InvGate (solo lectura) + el resumen de calidad.
 *
 * El bloque `calidad` (top de operadores y promedios) se devuelve para todos
 * los roles con acceso a la vista.
 *
 * Caches: Wise 10 s, casos de InvGate 60 s, calidad 5 min.
 */
export const GET: APIRoute = async ({ locals }) => {
  const denied = await requireReadAccess(locals, "broadcast");
  if (denied) return denied;

  try {
    const emptyCasos: CasosAutogestionResumen = {
      helpdeskId: 0,
      total: 0,
      porCategoria: [],
      casos: [],
      actualizadoAt: new Date().toISOString(),
    };

    const emptyCalidad: CalidadResumenBroadcast = {
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
      top: [],
      actualizadoAt: new Date().toISOString(),
    };

    const [snapshot, casos, calidad] = await Promise.all([
      getWiseCallsSnapshot(),
      getCasosAutogestion().catch((error) => ({
        ...emptyCasos,
        warning: sanitizeError(error),
      })),
      getCalidadResumenBroadcast().catch((error) => {
        console.error(
          "[Broadcast] No se pudo calcular el resumen de calidad:",
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
