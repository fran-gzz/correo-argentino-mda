import type { APIRoute } from "astro";
import { db } from "@db/index";
import { supportGuides } from "@db/schema";
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

  const guideId = Number(id);

  try {
    const [deleted] = await db
      .delete(supportGuides)
      .where(eq(supportGuides.id, guideId))
      .returning({ helpDeskName: supportGuides.helpDeskName });

    if (deleted) {
      await logAdminAction(
        user.username || "Sistema",
        `Eliminó el soporte "${deleted.helpDeskName}"`
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: `Soporte "${deleted.helpDeskName}" eliminado con éxito.`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(JSON.stringify({ error: "El soporte no existe" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error deleting support guide:", error);
    return new Response(JSON.stringify({ error: "Error al eliminar el soporte" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
