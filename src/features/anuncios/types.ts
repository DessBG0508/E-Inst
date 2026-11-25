export type AnuncioTipo = "taller" | "recordatorio" | "informativo" | "evento";

export type AnuncioPublicoObjetivo = "todos" | "rojo" | "amarillo" | "verde" | "sin_tamizaje";

export interface AnuncioItem {
  id: string;
  titulo: string;
  descripcion: string;
  descripcion_larga?: string | null;
  tipo: AnuncioTipo;
  fecha_evento?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  lugar?: string | null;
  ponente?: string | null;
  requisitos?: string | null;
  cupo?: number | null;
  inscritos: number;
  publico_objetivo: AnuncioPublicoObjetivo;
  imagen_url?: string | null;
  activo: boolean;
  creado_por?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnuncioInscripcion {
  id: string;
  estudiante_id: string;
  anuncio_id: string;
  fecha: string;
}

export interface AnuncioFormInput {
  titulo: string;
  descripcion: string;
  descripcion_larga?: string;
  tipo: AnuncioTipo;
  fecha_evento?: string;
  hora_inicio?: string;
  hora_fin?: string;
  lugar?: string;
  ponente?: string;
  requisitos?: string;
  cupo?: number | null;
  publico_objetivo: AnuncioPublicoObjetivo;
  imagen_url?: string;
  activo: boolean;
}

export interface AnuncioTipoMeta {
  id: AnuncioTipo;
  label: string;
  pluralLabel: string;
  hexColor: string;
  badgeClassName: string;
}

export const ANUNCIO_TIPO_META: Record<AnuncioTipo, AnuncioTipoMeta> = {
  taller: {
    id: "taller",
    label: "Taller",
    pluralLabel: "Talleres",
    hexColor: "#B8860B",
    badgeClassName: "bg-[#B8860B] text-white border-transparent",
  },
  evento: {
    id: "evento",
    label: "Evento",
    pluralLabel: "Eventos",
    hexColor: "#C8102E",
    badgeClassName: "bg-[#C8102E] text-white border-transparent",
  },
  informativo: {
    id: "informativo",
    label: "Informativo",
    pluralLabel: "Informativos",
    hexColor: "#1F4D2C",
    badgeClassName: "bg-[#1F4D2C] text-white border-transparent",
  },
  recordatorio: {
    id: "recordatorio",
    label: "Recordatorio",
    pluralLabel: "Recordatorios",
    hexColor: "#4A7C59",
    badgeClassName: "bg-[#4A7C59] text-white border-transparent",
  },
};

export const PUBLICO_OBJETIVO_LABELS: Record<AnuncioPublicoObjetivo, string> = {
  todos: "Toda la comunidad TESH",
  rojo: "Prioridad clínica alta (Rojo)",
  amarillo: "Seguimiento preventivo (Amarillo)",
  verde: "Bienestar general (Verde)",
  sin_tamizaje: "Estudiantes sin tamizaje reciente",
};

/**
 * Formatea una fecha YYYY-MM-DD a español de México:
 * ej. "Viernes 27 de noviembre de 2026"
 */
export function formatFechaMx(fecha?: string | null): string {
  if (!fecha) return "Fecha por confirmar";
  const trimmed = fecha.trim();
  const dateObj = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T12:00:00`)
    : new Date(trimmed);

  if (Number.isNaN(dateObj.getTime())) return trimmed;

  const formatted = dateObj.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Limpia prefijos redundantes como "Taller: " o "Evento: " en el título
 */
export function cleanAnuncioTitle(titulo: string): string {
  return titulo.replace(/^(taller|evento|informativo|recordatorio)\s*:\s*/i, "").trim();
}
