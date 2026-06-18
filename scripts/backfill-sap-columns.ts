import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import { offices, provinces } from "../src/db/schema";
import { normalizeSearchValue } from "../src/lib/clientSearch";
import { normalizeName, normalizeField } from "./normalize-offices"; // Reusing the same normalizer

const csvPath = path.resolve("./src/data/baseSAS-28-5(baseSAS-28-5).csv");

const parseBoolean = (val: string | undefined): boolean => {
  if (!val) return false;
  return val.trim().toUpperCase() === "SI";
};

const cleanString = (val: string | undefined): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed === "") return null;
  return trimmed;
};

// Mapa pre-cargado de provincias
let provMap: Record<string, string> = {};

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(`[Script] Starting backfill. Mode: ${dryRun ? "DRY-RUN (no writes)" : "WRITE"}`);

  // Load provinces mapping from name (normalized) to code
  const allProvinces = await db.select().from(provinces);
  for (const p of allProvinces) {
    provMap[p.name.toUpperCase()] = p.code;
  }
  // Añadir mapeos extra para nombres de provincias que puedan diferir
  provMap["CABA"] = "C";
  provMap["CIUDAD AUTONOMA BUENOS AIRES"] = "C";
  provMap["CAPITAL FEDERAL"] = "C";
  provMap["BUENOS AIRES"] = "B";
  provMap["TIERRA DEL FUEGO"] = "V";

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  
  // Parse CSV
  // El CSV tiene cabeceras. fields separated by ;
  const records = parse(fileContent, {
    delimiter: ';',
    columns: false,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  });

  const header = records[0];
  const dataRows = records.slice(1);

  console.log(`[Script] Found ${dataRows.length} data rows. Processing...`);

  let updatedCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    
    const nis = cleanString(row[0]);
    if (!nis) continue;

    try {
      const type = cleanString(row[1]) || "UNKNOWN";
      const officeType = cleanString(row[2]);
      const rubric = cleanString(row[3]);
      const rawName = cleanString(row[4]) || "UNKNOWN";
      const provName = cleanString(row[5]);
      const county = cleanString(row[6]);
      const locality = cleanString(row[7]);
      const street = cleanString(row[8]);
      const number = cleanString(row[9]);
      const region = cleanString(row[14]);
      const zone = cleanString(row[15]);
      const parentNis = cleanString(row[16]);
      const categoryClass = cleanString(row[19]);
      const enRed = parseBoolean(row[20]);
      
      const payroll = parseBoolean(row[21]);
      const taxExempt = parseBoolean(row[22]);
      const division = cleanString(row[23]);
      const company = cleanString(row[24]);
      const warehouse = cleanString(row[25]);
      const profitCenter = cleanString(row[26]);
      const cctAdminOffice = cleanString(row[27]);
      const ccCommercial = cleanString(row[28]);
      const ccCommercialCorp = cleanString(row[29]);
      const ccElectoral = cleanString(row[30]);
      const ccNetworkMgmt = cleanString(row[31]);
      const ccOperations = cleanString(row[32]);
      const ccOperational = cleanString(row[33]);
      const ccHr = cleanString(row[34]);
      const ccSecurity = cleanString(row[35]);
      const ccAdmin = cleanString(row[36]);
      const ccAdmission = cleanString(row[37]);
      const ccCtp = cleanString(row[38]);
      const ccCtt = cleanString(row[39]);
      const ccTransport = cleanString(row[40]);
      const ccLogistics = cleanString(row[41]);
      const posAutoAuto = cleanString(row[42]);
      const posCurrentAccount = cleanString(row[43]);
      const posManual = cleanString(row[44]);
      const posManualAuto = cleanString(row[45]);
      const posPlantaMg = cleanString(row[46]);
      const posVirtual = cleanString(row[47]);
      const posAutoAuto2 = cleanString(row[48]);
      const posSapTerminal = cleanString(row[49]);
      
      // Look up existing office
      const existing = await db.select().from(offices).where(eq(offices.code, nis)).limit(1);

      if (existing.length > 0) {
        // UPDATE solo columnas nuevas SAP
        const o = existing[0];
        
        if (!dryRun) {
          await db.update(offices)
            .set({
              payroll,
              taxExempt,
              division,
              company,
              warehouse,
              profitCenter,
              cctAdminOffice,
              ccCommercial,
              ccCommercialCorp,
              ccElectoral,
              ccNetworkMgmt,
              ccOperations,
              ccOperational,
              ccHr,
              ccSecurity,
              ccAdmin,
              ccAdmission,
              ccCtp,
              ccCtt,
              ccTransport,
              ccLogistics,
              posAutoAuto,
              posCurrentAccount,
              posManual,
              posManualAuto,
              posPlantaMg,
              posVirtual,
              posAutoAuto2,
              posSapTerminal
            })
            .where(eq(offices.id, o.id));
        }
        updatedCount++;
      } else {
        // CREATE nueva oficina con todo
        // Resolver province code
        let pCode = "NONE_MATCH";
        if (provName) {
            const mapped = provMap[provName.toUpperCase()];
            if (mapped) pCode = mapped;
        }

        const normalizedName = normalizeName(0, rawName).toUpperCase();
        let address = street;
        if (address && number) {
            address = `${address} ${number}`;
        }

        const nextSearchableText = normalizeSearchValue(
            [nis, normalizedName, normalizeField(locality), parentNis, normalizeField(address)].filter(Boolean).join(" ")
        );

        if (!dryRun) {
          await db.insert(offices).values({
            code: nis,
            name: normalizedName,
            type,
            officeType,
            rubric,
            provinceCode: pCode,
            county: normalizeField(county),
            locality: normalizeField(locality),
            street: normalizeField(street),
            number,
            address: normalizeField(address),
            zone: normalizeField(zone),
            parentNis,
            categoryClass,
            enRed,
            paqarAdmision: parseBoolean(row[50]),
            paqarEntrega: parseBoolean(row[51]),
            
            payroll,
            taxExempt,
            division,
            company,
            warehouse,
            profitCenter,
            cctAdminOffice,
            ccCommercial,
            ccCommercialCorp,
            ccElectoral,
            ccNetworkMgmt,
            ccOperations,
            ccOperational,
            ccHr,
            ccSecurity,
            ccAdmin,
            ccAdmission,
            ccCtp,
            ccCtt,
            ccTransport,
            ccLogistics,
            posAutoAuto,
            posCurrentAccount,
            posManual,
            posManualAuto,
            posPlantaMg,
            posVirtual,
            posAutoAuto2,
            posSapTerminal,

            searchableText: nextSearchableText
          });
        }
        createdCount++;
      }

    } catch (e) {
      console.error(`[Error] on row ${i + 2} for NIS ${nis}:`, e);
      errorCount++;
    }
  }

  console.log(`[Script] Migration finished.`);
  console.log(`Updated: ${updatedCount}, Created: ${createdCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);

  if (!dryRun) {
    console.log(`[Script] Rebuilding searchable text for FTS...`);
    // Backfill searchable_text for ALL offices
    const allOffices = await db.select().from(offices);
    for (const office of allOffices) {
      const textToSearch = [office.code, office.name, office.locality, office.parentNis, office.address].filter(Boolean).join(" ");
      const normalized = normalizeSearchValue(textToSearch);
      await db.update(offices).set({ searchableText: normalized }).where(eq(offices.id, office.id));
    }
    
    console.log(`[Script] Rebuilding FTS index...`);
    // Regenerar el FTS5 de offices. El script "setup-fts.ts" ya corre los triggers, pero si ya hay registros, el UPDATE lo re-dispara.
    // O podemos forzar el rebuild manualmente:
    import("better-sqlite3").then((Database) => {
      const dbPath = path.resolve("./database/mda.db");
      const bdb = new Database.default(dbPath);
      bdb.prepare(`INSERT INTO offices_fts(offices_fts) VALUES('rebuild');`).run();
      bdb.close();
      console.log(`[Script] FTS index rebuilt.`);
    }).catch(e => console.error("Could not run better-sqlite3 for rebuild", e));
  }
}

run().catch((err) => {
  console.error("Critical error in backfill script:", err);
  process.exit(1);
});
