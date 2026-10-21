/**
 * Presentación de una llamada en el wallboard.
 *
 * Módulo puro (sin dependencias de servidor) para que el SSR y el script de
 * polling del navegador muestren exactamente el mismo texto.
 */

import type { LlamadaEstado } from "@/lib/llamadas/estados";

export interface CallDisplayInput {
  state: LlamadaEstado;
  agentName: string;
  groupName: string;
}

export interface CallDisplay {
  /** Línea principal de la card. */
  title: string;
  /** Línea secundaria (grupo de ingreso o contexto del estado). */
  subtitle: string;
}

const SIN_ASIGNAR = "[sin asignar]";

function sinAgente(agentName: string): boolean {
  const key = (agentName || "").trim().toLowerCase();
  return key === "" || key === SIN_ASIGNAR;
}

/**
 * Las llamadas que esperan en el IVR no tienen agente: mostrar
 * "[Sin Asignar]" no aporta nada a la mesa, así que se explica el estado.
 */
export function describeCall(call: CallDisplayInput): CallDisplay {
  if (call.state === "en_ivr" && sinAgente(call.agentName)) {
    return {
      title: "En IVR",
      subtitle: "Cliente se encuentra en el menú",
    };
  }

  return {
    title: (call.agentName || "").trim() || "Sin agente asignado",
    subtitle: (call.groupName || "").trim(),
  };
}
