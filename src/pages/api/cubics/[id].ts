import type { APIRoute } from "astro";
import { db } from "@db/index";
import { cubics, cubicAssignments } from "@db/schema";
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

  const cubicId = Number(id);

  try {
    // Delete assignments first
    await db
      .delete(cubicAssignments)
      .where(eq(cubicAssignments.cubicId, cubicId));

    const [deleted] = await db
      .delete(cubics)
      .where(eq(cubics.id, cubicId))
      .returning({ name: cubics.name });

    if (deleted) {
      await logAdminAction(
        user.username || "Sistema",
        `Eliminó el cubic "${deleted.name}"`
      );
      return new Response(
        JSON.stringify({
          success: true,
          message: `Ordenador "${deleted.name}" dado de baja con éxito.`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(JSON.stringify({ error: "El ordenador no existe" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Error deleting cubic:", error);
    return new Response(JSON.stringify({ error: "Error al dar de baja el ordenador" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
