/**
 * Presentación del wallboard de TV.
 *
 * Módulo puro (sin dependencias de servidor) para que el SSR y el script de
 * polling del navegador muestren exactamente el mismo texto.
 */

import type { LlamadaEstado } from "@/lib/llamadas/estados";
import { formatChannelAverageScore } from "@/lib/qualityCalculator";

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

/**
 * Antigüedad legible: "hace 45 min", "hace 3h 20m", "hace 2 d".
 * Recibe segundos para poder reusarse en el tick del cliente.
 */
export function formatAge(totalSeconds: number): string {
  const minutes = Math.max(0, Math.floor(totalSeconds / 60));
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes > 0 ? `hace ${hours}h ${restMinutes}m` : `hace ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

/** Duración de una llamada en vivo: "1m 30s", "2h 05m". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}

/**
 * Puntaje con un decimal (mismo formato que la UI de calidad).
 * Se centraliza para que el SSR y el polling no muestren números distintos.
 */
export function formatScore(average: number | null | undefined): string {
  return formatChannelAverageScore(average);
}

/**
 * Color del puntaje para la TV.
 *
 * `text-warning` (#e2ad1f) queda en 1.79:1 sobre base-100 claro, así que la
 * banda media usa el color de texto normal en vez de ámbar. El número sigue
 * siendo la señal principal; el color solo acompaña.
 */
export function scoreToneClass(average: number | null | undefined): string {
  if (average === null || average === undefined || Number.isNaN(average)) {
    return "text-base-content/60";
  }
  if (average >= 85) return "text-success";
  if (average >= 70) return "text-base-content";
  return "text-error";
}
