import type { APIRoute } from "astro";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { getWiseCallsSnapshot } from "@/lib/wise-cx-calls";
import { getCasosAutogestion } from "@/lib/invgate/casosAutogestion";
import type { CasosAutogestionResumen } from "@/lib/invgate/casosAutogestion";

/**
 * GET /api/broadcast/estado
 *
 * Snapshot del wallboard: KPIs y detalle de llamadas en vivo (Wise CX) + los
 * casos de autogestión de InvGate (solo lectura).
 *
 * Caches: Wise 10 s, casos de InvGate 60 s. N clientes golpeando este endpoint
 * generan una sola consulta por fuente y por ventana.
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

    const [snapshot, casos] = await Promise.all([
      getWiseCallsSnapshot(),
      getCasosAutogestion().catch((error) => ({
        ...emptyCasos,
        warning: sanitizeError(error),
      })),
    ]);

    return jsonResponse(
      {
        kpis: snapshot.kpis,
        calls: snapshot.calls,
        fetchedAt: snapshot.fetchedAt,
        stale: snapshot.stale,
        warning: snapshot.warning,
        casos,
      },
      200,
      "no-store",
    );
  } catch (error) {
    return jsonError(sanitizeError(error), 500, "no-store");
  }
};
