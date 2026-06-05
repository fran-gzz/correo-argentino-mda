import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../src/db/index";
import { supportGuides } from "../src/db/schema";

const CORRECTIONS: Record<string, string> = {
  "Operaci\uFFFDn": "Operación",
  "Telegr\uFFFDfica": "Telegráfica",
  "T\uFFFDcnico": "Técnico",
  "Gesti\uFFFDn": "Gestión",
  "Informaci\uFFFDn": "Información",
  "Administraci\uFFFDn": "Administración",
  "Telegraf\uFFFDa": "Telegrafía",
  "H\uFFFDbridos": "Híbridos",
  "anulaci\uFFFDn": "anulación",
  "Log\uFFFDstica": "Logística",
  "M\uFFFDdem": "Módem",
  "Telefon\uFFFDa": "Telefonía",
  "Instalaci\uFFFDn": "Instalación",
  "telefon\uFFFDa": "telefonía",
  "L\uFFFDnea": "Línea",
  "M\uFFFDvil": "Móvil",
  "Tel\uFFFDfono": "Teléfono",
  "Anal\uFFFDgico": "Analógico",
  "Telef\uFFFDnia": "Telefonía",
  "P\uFFFDblica": "Pública",
  "Actualizaci\uFFFDn": "Actualización",
  "\uFFFDComunicaciones": "Comunicaciones",
  "Microinform\uFFFDtica": "Microinformática",
  "deber\uFFFD": "deberá",
  "ServT\uFFFDcnico": "ServTécnico",
  "Almac\uFFFDn": "Almacén",
  "Tecnolog\uFFFDa": "Tecnología",
  "Coordinaci\uFFFDn": "Coordinación",
  "Desv\uFFFDo": "Desvío",
  "Normatizaci\uFFFDn": "Normatización",
  "Relgamentaci\uFFFDn": "Reglamentación",
  "Integraci\uFFFDn": "Integración",
  "aplicaci\uFFFDn": "aplicación",
  "Creaci\uFFFDn": "Creación",
  "petici\uFFFDn": "petición",
  "gen\uFFFDrica": "genérica",
  "Inform\uFFFDtica": "Informática",
  "liberaci\uFFFDn": "liberación",
  "instalaci\uFFFDn": "instalación",
  "actualizaci\uFFFDn": "actualización",
  "desinstalaci\uFFFDn": "desinstalación",
  "inform\uFFFDtica": "informática",
  "Biom\uFFFDtrico": "Biométrico",
  "gesti\uFFFDn": "gestión",
  "Ejecuci\uFFFDn": "Ejecución",
  "producci\uFFFDn": "producción",
  "Migraci\uFFFDn": "Migración",
};

function cleanText(text: string | null): string | null {
  if (!text) return text;
  let cleaned = text;
  for (const [corrupt, correct] of Object.entries(CORRECTIONS)) {
    cleaned = cleaned.replaceAll(corrupt, correct);
  }
  return cleaned;
}

async function run() {
  const csvPath = resolve("src/data/soportes.csv");
  console.log(`[Import] Leyendo archivo CSV: ${csvPath}`);
  
  const rawContent = readFileSync(csvPath, "utf8");
  const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length <= 1) {
    console.error("[Import] El archivo CSV está vacío o solo contiene cabeceras.");
    process.exit(1);
  }

  const headers = lines.shift()?.split(";");
  console.log("[Import] Cabeceras encontradas:", headers);

  const records = lines.map((line) => {
    const parts = line.split(";");
    return {
      helpDeskName: "",
      legacyName: cleanText(parts[0]?.trim() || null),
      invgateName: cleanText(parts[1]?.trim() || null),
      route: cleanText(parts[2]?.trim() || null),
      topics: cleanText(parts[3]?.trim() || null),
      contacts: "",
      referents: "",
      notes: "",
    };
  });

  console.log(`[Import] Parseados ${records.length} registros del CSV.`);

  try {
    console.log("[Import] Eliminando todos los registros de la tabla support_guides...");
    await db.delete(supportGuides).run();

    console.log("[Import] Insertando nuevos registros...");
    await db.insert(supportGuides).values(records).run();
    console.log(`✅ [Import] Importación finalizada con éxito. ${records.length} registros insertados.`);
  } catch (error) {
    console.error("❌ [Import] Error al importar los datos:", error);
    process.exit(1);
  }
}

run();
