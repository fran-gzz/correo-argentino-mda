import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "../src/db/index";
import { terminals } from "../src/db/schema";

const LEGACY_URL = "http://b1842zacs0255/mda/index.php";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ROW_SELECTOR = "#content > div table tbody tr";

const FALLBACK_PATH = resolve("src/data/inventario_terminales.json");

interface TerminalRecord {
  hostname: string;
  macAddress: string | null;
  ipAddress: string | null;
  operatingSystem: string | null;
  osArchitecture: string | null;
  ram: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  nis: string | null;
  nis2: string | null;
  lastContact: string | null;
}

function cleanValue(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function parseRow(
  cells: cheerio.Cheerio<AnyNode>,
  $: cheerio.CheerioAPI,
): TerminalRecord | null {
  const hostname = cleanValue($(cells[0]).text());
  if (!hostname) return null;

  return {
    hostname,
    macAddress: cleanValue($(cells[1]).text()),
    ipAddress: cleanValue($(cells[2]).text()),
    operatingSystem: cleanValue($(cells[3]).text()),
    osArchitecture: cleanValue($(cells[4]).text()),
    ram: cleanValue($(cells[5]).text()),
    serialNumber: cleanValue($(cells[6]).text()),
    manufacturer: cleanValue($(cells[7]).text()),
    model: cleanValue($(cells[8]).text()),
    nis: cleanValue($(cells[12]).text()),
    nis2: cleanValue($(cells[13]).text()),
    lastContact: cleanValue($(cells[14]).text()),
  };
}

function mapJsonRecord(raw: Record<string, unknown>): TerminalRecord | null {
  const hostname = typeof raw.hostname === "string" ? raw.hostname.trim() : "";
  if (!hostname) return null;

  const str = (key: string): string | null => {
    const val = raw[key];
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  };

  return {
    hostname,
    macAddress: str("macAddress"),
    ipAddress: str("ipAddress"),
    operatingSystem: str("operatingSystem"),
    osArchitecture: str("osArchitecture"),
    ram: str("ram"),
    serialNumber: str("serialNumber"),
    manufacturer: str("manufacturer"),
    model: str("model"),
    nis: str("nis"),
    nis2: str("nis2"),
    lastContact: str("lastContact"),
  };
}

async function upsertRecord(
  record: TerminalRecord,
  syncedAt: string,
): Promise<void> {
  await db
    .insert(terminals)
    .values({
      hostname: record.hostname,
      macAddress: record.macAddress,
      ipAddress: record.ipAddress,
      operatingSystem: record.operatingSystem,
      osArchitecture: record.osArchitecture,
      ram: record.ram,
      serialNumber: record.serialNumber,
      manufacturer: record.manufacturer,
      model: record.model,
      nis: record.nis,
      nis2: record.nis2,
      lastContact: record.lastContact,
      syncedAt,
    })
    .onConflictDoUpdate({
      target: terminals.hostname,
      set: {
        macAddress: record.macAddress,
        ipAddress: record.ipAddress,
        operatingSystem: record.operatingSystem,
        osArchitecture: record.osArchitecture,
        ram: record.ram,
        serialNumber: record.serialNumber,
        manufacturer: record.manufacturer,
        model: record.model,
        nis: record.nis,
        nis2: record.nis2,
        lastContact: record.lastContact,
        syncedAt,
      },
    });
}

async function fetchRemoteRecords(): Promise<TerminalRecord[]> {
  const response = await fetch(LEGACY_URL, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();

  if (!html || html.trim().length === 0) {
    throw new Error("El cuerpo de la respuesta está vacío.");
  }

  console.log(
    `[Sync] HTML obtenido correctamente (${(html.length / 1024).toFixed(1)} KB).`,
  );

  const $ = cheerio.load(html);
  const rows = $(ROW_SELECTOR);

  if (rows.length === 0) {
    throw new Error("No se encontraron filas en el selector especificado.");
  }

  console.log(`[Sync] Filas encontradas en el HTML: ${rows.length}`);

  const records: TerminalRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cells = $(rows[i]).find("td");
    const record = parseRow(cells, $);
    if (record) records.push(record);
  }

  return records;
}

async function loadFallbackRecords(): Promise<TerminalRecord[]> {
  console.log(`[Sync] Leyendo archivo de contingencia: ${FALLBACK_PATH}`);

  const raw = await readFile(FALLBACK_PATH, "utf-8");
  const data: unknown = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("El JSON de contingencia no contiene un array.");
  }

  const records: TerminalRecord[] = [];

  for (const entry of data) {
    const record = mapJsonRecord(entry as Record<string, unknown>);
    if (record) records.push(record);
  }

  console.log(
    `[Sync] Registros válidos del archivo local: ${records.length}`,
  );

  return records;
}

async function syncLegacyInventory(): Promise<void> {
  const startTime = new Date();
  console.log(
    `[Sync] Sincronización de inventario legacy iniciada: ${startTime.toISOString()}`,
  );

  let records: TerminalRecord[];

  try {
    records = await fetchRemoteRecords();
  } catch (fetchError) {
    console.warn(
      "[Sync] Advertencia: Servidor remoto inaccesible. Iniciando modo de contingencia con datos locales.",
    );
    console.warn(`[Sync] Detalle: ${fetchError instanceof Error ? fetchError.message : fetchError}`);
    records = await loadFallbackRecords();
  }

  if (records.length === 0) {
    console.error("[Sync] No se obtuvieron registros de ninguna fuente.");
    process.exit(1);
  }

  const syncedAt = startTime.toISOString();
  let processed = 0;

  for (const record of records) {
    await upsertRecord(record, syncedAt);
    processed++;
  }

  const elapsed = ((Date.now() - startTime.getTime()) / 1000).toFixed(2);
  console.log(
    `[Sync] Sincronización finalizada en ${elapsed}s. Procesados: ${processed}`,
  );
}

try {
  await syncLegacyInventory();
} catch (error) {
  console.error("[Sync] Error crítico:", error);
  process.exit(1);
}

