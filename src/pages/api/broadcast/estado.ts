import type { APIRoute } from "astro";
import { jsonError, jsonResponse, sanitizeError } from "@lib/apiResponse";
import { requireReadAccess } from "@lib/rbac-middleware";
import { getWiseCallsSnapshot } from "@/lib/wise-cx-calls";

/**
 * GET /api/broadcast/estado
 *
 * Snapshot del wallboard de llamadas en vivo: KPIs por estado (Wise CX) y
 * detalle de las llamadas vivas.
 *
 * El snapshot de Wise se cachea 10 s server-side: N clientes golpeando este
 * endpoint generan una sola consulta a Wise por ventana.
 */
export const GET: APIRoute = async ({ locals }) => {
  const denied = await requireReadAccess(locals, "broadcast");
  if (denied) return denied;

  try {
    const snapshot = await getWiseCallsSnapshot();

    return jsonResponse(
      {
        kpis: snapshot.kpis,
        calls: snapshot.calls,
        fetchedAt: snapshot.fetchedAt,
        stale: snapshot.stale,
        warning: snapshot.warning,
      },
      200,
      "no-store",
    );
  } catch (error) {
    return jsonError(sanitizeError(error), 500, "no-store");
  }
};
