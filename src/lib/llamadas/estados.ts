/**
 * Estados de llamada de Wise CX, normalizados para el portal.
 *
 * Módulo puro (sin dependencias de servidor) para poder importarlo tanto
 * desde componentes .astro (servidor) como desde el script de polling del
 * navegador.
 */

export type LlamadaEstado =
  | "sonando"
  | "en_curso"
  | "en_cola"
  | "en_ivr"
  | "no_atendida"
  | "finalizada"
  | "otra";

export const LLAMADA_ESTADO_LABELS: Record<LlamadaEstado, string> = {
  sonando: "Sonando",
  en_curso: "En curso",
  en_cola: "En cola",
  en_ivr: "En IVR",
  no_atendida: "No atendida",
  finalizada: "Finalizada",
  otra: "Otro",
};

/** Tono DaisyUI del badge por estado. */
export const LLAMADA_ESTADO_TONES: Record<LlamadaEstado, string> = {
  sonando: "warning",
  en_curso: "success",
  en_cola: "info",
  en_ivr: "accent",
  no_atendida: "error",
  finalizada: "neutral",
  otra: "neutral",
};

/** Estados que representan una llamada viva (la mesa los necesita ver). */
export const LLAMADA_ESTADOS_VIVOS: LlamadaEstado[] = [
  "sonando",
  "en_curso",
  "en_cola",
  "en_ivr",
];

/**
 * Alias de Wise CX -> estado canónico.
 *
 * Nombres observados en Me599 (vienen de dos vistas del mismo dato: el
 * agrupado usa "En Curso" y el detalle "Respondida", por eso el alias).
 */
export const LLAMADA_ESTADO_ALIASES: Record<string, LlamadaEstado> = {
  // En curso (atendida por un agente, todavía activa)
  respondida: "en_curso",
  "en curso": "en_curso",
  atendida: "en_curso",
  "en atencion": "en_curso",
  // Sonando en el ring del agente
  sonando: "sonando",
  timbrando: "sonando",
  ringing: "sonando",
  // En cola, esperando asignación
  "en cola": "en_cola",
  "en espera": "en_cola",
  cola: "en_cola",
  // En IVR
  "en ivr": "en_ivr",
  ivr: "en_ivr",
  // No atendida
  "no respondida": "no_atendida",
  "sin atender": "no_atendida",
  abandonada: "no_atendida",
  // Terminadas
  "completa por cliente": "finalizada",
  "completa por contacto": "finalizada",
  "completa por agente": "finalizada",
  "completa por usuario": "finalizada",
  "completada en ivr": "finalizada",
  "corte en ivr": "finalizada",
  "corte repentino": "finalizada",
  fallida: "finalizada",
  desbordada: "finalizada",
  "mensaje de voz": "finalizada",
  redireccionada: "finalizada",
};

/** Quita tildes, puntuación y espacios; en minúsculas. */
export function normalizeLlamadaText(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function classifyLlamadaEstado(rawStatus: string): LlamadaEstado {
  const key = normalizeLlamadaText(rawStatus);
  if (!key) return "otra";
  if (LLAMADA_ESTADO_ALIASES[key]) return LLAMADA_ESTADO_ALIASES[key];

  // Fallback por prefijo para variantes no catalogadas.
  if (key.startsWith("completa") || key.startsWith("corte")) return "finalizada";
  if (key.startsWith("no ")) return "no_atendida";
  return "otra";
}
