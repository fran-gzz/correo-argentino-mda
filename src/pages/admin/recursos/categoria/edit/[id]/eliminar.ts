import type { APIRoute } from "astro";
import { db } from "@db/index";
import { resourceCategories, resourceLinks } from "@db/schema";
import { eq } from "drizzle-orm";
import { logAdminAction } from "@lib/auditLogger";

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const categoryId = params.id;
  if (!categoryId) return new Response("ID de categoría no proporcionado", { status: 400 });

  if (categoryId === "uncategorized") {
    const base = import.meta.env.BASE_URL || "/";
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    return redirect(`${cleanBase}/admin/recursos?toast_msg=${encodeURIComponent("No se puede eliminar la categoría por defecto")}&toast_type=error`);
  }

  const formData = await request.formData();
  const deleteOption = formData.get("deleteOption")?.toString(); // "cascade" | "unassign"

  try {
    if (deleteOption === "unassign") {
      // Asegurarse de que la categoría "uncategorized" exista
      const existingDefault = await db
        .select()
        .from(resourceCategories)
        .where(eq(resourceCategories.id, "uncategorized"))
        .limit(1);

      if (existingDefault.length === 0) {
        await db.insert(resourceCategories).values({
          id: "uncategorized",
          title: "Sin Categoría",
          iconName: "boxicons:folder",
          tone: "neutral",
        });
      }

      // Reasignar los enlaces a la categoría por defecto
      await db
        .update(resourceLinks)
        .set({ categoryId: "uncategorized" })
        .where(eq(resourceLinks.categoryId, categoryId));
    }

    // Si fue 'unassign', los enlaces ya se movieron. 
    // Si fue 'cascade', la eliminación de la categoría los eliminará en cascada (depende de ON DELETE CASCADE de la BD)
    // Para mayor seguridad en caso de que SQLite no tenga activado PRAGMA foreign_keys, eliminamos los enlaces manualmente si es cascada.
    if (deleteOption === "cascade") {
      await db.delete(resourceLinks).where(eq(resourceLinks.categoryId, categoryId));
    }

    // Obtener el nombre de la categoría antes de eliminarla
    const [categoryToDelete] = await db
      .select({ title: resourceCategories.title })
      .from(resourceCategories)
      .where(eq(resourceCategories.id, categoryId))
      .limit(1);
    const categoryTitle = categoryToDelete?.title || categoryId;

    // Eliminar la categoría
    await db.delete(resourceCategories).where(eq(resourceCategories.id, categoryId));
    await logAdminAction((locals as any).user?.username || 'Sistema', `Eliminó la categoría de recursos "${categoryTitle}"`);

    const base = import.meta.env.BASE_URL || "/";
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    return redirect(`${cleanBase}/admin/recursos?toast_msg=${encodeURIComponent("Categoría eliminada con éxito")}&toast_type=success`);
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    const base = import.meta.env.BASE_URL || "/";
    const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
    return redirect(`${cleanBase}/admin/recursos?toast_msg=${encodeURIComponent("Error al eliminar la categoría")}&toast_type=error`);
  }
};
