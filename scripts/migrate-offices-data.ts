import { db } from "../src/db/index";
import { regions, provinces, offices } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function runMigration() {
  console.log("Iniciando migración...");

  // 1. Insertar Regiones
  await db
    .insert(regions)
    .values([
      { id: "CABA", name: "CABA" },
      { id: "SUR", name: "Región Sur" },
      { id: "PBA-LP", name: "Buenos Aires y La Pampa" },
      { id: "NEA", name: "Noreste Argentino" },
      { id: "NOA", name: "Noroeste Argentino" },
    ])
    .onConflictDoNothing();

  // 2. Insertar Provincias
  const provincesData = [
    { code: "C", name: "CABA", regionId: "CABA" },
    { code: "Q", name: "Neuquén", regionId: "SUR" },
    { code: "R", name: "Río Negro", regionId: "SUR" },
    { code: "U", name: "Chubut", regionId: "SUR" },
    { code: "Z", name: "Santa Cruz", regionId: "SUR" },
    { code: "V", name: "Tierra del Fuego", regionId: "SUR" },
    { code: "B", name: "Buenos Aires", regionId: "PBA-LP" },
    { code: "L", name: "La Pampa", regionId: "PBA-LP" },
    { code: "N", name: "Misiones", regionId: "NEA" },
    { code: "W", name: "Corrientes", regionId: "NEA" },
    { code: "E", name: "Entre Ríos", regionId: "NEA" },
    { code: "S", name: "Santa Fe", regionId: "NEA" },
    { code: "X", name: "Córdoba", regionId: "NEA" },
    { code: "H", name: "Chaco", regionId: "NEA" },
    { code: "P", name: "Formosa", regionId: "NEA" },
    { code: "M", name: "Mendoza", regionId: "NOA" },
    { code: "D", name: "San Luis", regionId: "NOA" },
    { code: "J", name: "San Juan", regionId: "NOA" },
    { code: "F", name: "La Rioja", regionId: "NOA" },
    { code: "G", name: "Santiago del Estero", regionId: "NOA" },
    { code: "K", name: "Catamarca", regionId: "NOA" },
    { code: "T", name: "Tucumán", regionId: "NOA" },
    { code: "A", name: "Salta", regionId: "NOA" },
    { code: "Y", name: "Jujuy", regionId: "NOA" },
  ];

  for (const prov of provincesData) {
    await db.insert(provinces).values(prov).onConflictDoNothing();
  }

  // 3. Migrar datos de la columna 'region' (la vieja) a 'provinceCode'
  const currentOffices = await db.select().from(offices);
  for (const office of currentOffices) {
    if (office.region) {
      await db
        .update(offices)
        .set({ provinceCode: office.region })
        .where(eq(offices.id, office.id));
    }
  }

  console.log("Migración completada con éxito.");
}

runMigration().catch(console.error);
