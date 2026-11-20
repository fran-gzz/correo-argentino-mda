/**
 * Mesa de InvGate donde vive la cola de autogestiones.
 *
 * Fuente única de verdad: antes el ID 3950 (QA) estaba hardcodeado en ~28
 * sitios, incluidos el ciclo automático y el filtro de operadores elegibles de
 * `getDisponibilidadHoy()`. Con las automatizaciones apagadas eso era
 * inofensivo; al encenderlas en producción hacía que el ciclo leyera la mesa
 * de QA y asignara operadores reales.
 *
 * El ID se resuelve por entorno (`INVGATE_AGENTS_HELPDESK_ID`). Si la variable
 * falta, el default depende de la instancia de InvGate configurada:
 *  - QA (`*qacorreo*`): 3950.
 *  - Producción: 2510 (Nivel 1 de TI_GSM_MDA TI).
 *
 * Un ID equivocado no devuelve error: devuelve una cola vacía. Por eso la
 * resolución expone si el ID vino de una variable explícita, y los paneles
 * pueden avisar en vez de mostrar un cero silencioso.
 */

const PRODUCTION_HELPDESK_ID = 2510;
const QA_HELPDESK_ID = 3950;

export type AgsHelpdeskSource = "env" | "production-default" | "qa-default";

export interface AgsHelpdeskResolution {
  id: number;
  /** true solo cuando `INVGATE_AGENTS_HELPDESK_ID` trae un valor válido. */
  explicit: boolean;
  source: AgsHelpdeskSource;
}

function readEnv(key: string): string {
  // Runtime-first (PM2/server.mjs con dotenv) y, si no existe, import.meta.env:
  // `astro dev` NO puebla process.env desde .env, solo import.meta.env.
  const runtime = process.env[key];
  if (runtime && typeof runtime === "string") return runtime;

  if (typeof import.meta !== "undefined") {
    const val = (import.meta.env as any)?.[key];
    if (typeof val === "string") return val;
  }
  return "";
}

/** QA y producción comparten el nombre de variable; se distinguen por la base. */
function isQaInstance(): boolean {
  const base = readEnv("INVGATE_BASE_URL") || readEnv("INVGATE_QA_BASE_URL");
  return /qacorreo|invgate.*qa|qa.*invgate/i.test(base);
}

export function getAgsHelpdeskResolution(): AgsHelpdeskResolution {
  const raw = readEnv("INVGATE_AGENTS_HELPDESK_ID");
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return { id: parsed, explicit: true, source: "env" };
    }
    console.warn(
      `[agsHelpdesk] INVGATE_AGENTS_HELPDESK_ID inválido ('${raw}'); se usa el default del entorno.`,
    );
  }

  const qa = isQaInstance();
  return {
    id: qa ? QA_HELPDESK_ID : PRODUCTION_HELPDESK_ID,
    explicit: false,
    source: qa ? "qa-default" : "production-default",
  };
}

export const AGS_HELPDESK_ID: number = getAgsHelpdeskResolution().id;
