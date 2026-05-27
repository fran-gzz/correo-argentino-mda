import { db } from "../src/db/index";
import { applicationCategories, applications } from "../src/db/schema";
import catalogo from "../src/data/catalogo_aplicativos.json";

async function seedAplicativos() {
  console.log("📦 Iniciando migración de aplicativos...");

  try {
    // 1. Extraer categorías únicas basándonos en el campo 'type' del JSON
    const uniqueTypes = new Set<string>();
    if (catalogo.items) {
      catalogo.items.forEach((item) => {
        if (item.type) uniqueTypes.add(item.type);
      });
    }

    // Si hay un paquete base (bundle), le creamos una categoría especial
    if (catalogo.bundle) {
      uniqueTypes.add("Paquetes");
    }

    // Insertar las categorías en la base de datos
    for (const type of uniqueTypes) {
      const categoryId = type.toLowerCase().replace(/\s+/g, "-"); // Ej: "Sistemas Operativos" -> "sistemas-operativos"
      await db
        .insert(applicationCategories)
        .values({
          id: categoryId,
          title: type,
        })
        .onConflictDoNothing();
    }
    console.log(`✅ ${uniqueTypes.size} Categorías insertadas.`);

    // 2. Insertar el Bundle (si existe en tu JSON)
    if (catalogo.bundle) {
      await db
        .insert(applications)
        .values({
          title: catalogo.bundle.title,
          categoryId: "paquetes",
          description: catalogo.bundle.description,
          version: null,
          filePath: catalogo.bundle.url,
        })
        .onConflictDoNothing();
    }

    // 3. Insertar cada Aplicativo y sus variantes
    let appsCount = 0;
    if (catalogo.items) {
      for (const item of catalogo.items) {
        const catId = item.type
          ? item.type.toLowerCase().replace(/\s+/g, "-")
          : null;

        // Si el aplicativo tiene múltiples versiones (Ej: Checkpoint VPN)
        if (item.variants && item.variants.length > 0) {
          for (const variant of item.variants) {
            await db
              .insert(applications)
              .values({
                title: item.title,
                categoryId: catId,
                description: variant.description || item.description,
                version: variant.version,
                filePath: variant.url,
              })
              .onConflictDoNothing();
            appsCount++;
          }
        } else {
          // Es un aplicativo de archivo único (Ej: ShareX, KiTTY)
          await db
            .insert(applications)
            .values({
              title: item.title,
              categoryId: catId,
              description: item.description,
              version: item.version || null,
              filePath: item.url,
            })
            .onConflictDoNothing();
          appsCount++;
        }
      }
    }

    console.log(
      `✅ ${appsCount} Aplicativos/Versiones migrados con éxito a la nueva BD.`,
    );
  } catch (error) {
    console.error("❌ Error en la migración:", error);
  }
}

seedAplicativos();
