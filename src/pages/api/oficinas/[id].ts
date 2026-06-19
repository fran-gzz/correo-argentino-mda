import type { APIRoute } from "astro";
import { db } from "@db/index";
import { offices } from "@db/schema";
import { eq } from "drizzle-orm";
import { logAdminAction } from "@lib/auditLogger";
import { isAllowed } from "@lib/rolesMatrix";

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || !isAllowed("Administrar Contenido", user.role)) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = params;
  if (!id || isNaN(Number(id))) {
    return new Response(JSON.stringify({ error: "ID no válido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const officeId = Number(id);

  try {
    const [deleted] = await db
      .delete(offices)
      .where(eq(offices.id, officeId))
      .returning({ code: offices.code, name: offices.name });

    if (deleted) {
      await logAdminAction(
        user.username || "Sistema",
        `Eliminó la oficina "${deleted.name}" (${deleted.code})`
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: `Oficina "${deleted.name}" (${deleted.code}) eliminada con éxito.`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(JSON.stringify({ error: "La oficina no existe" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error deleting office:", error);
    return new Response(JSON.stringify({ error: "Error al eliminar la oficina" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
