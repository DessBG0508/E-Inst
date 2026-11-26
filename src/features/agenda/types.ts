// ==============================================================================
// TIPOS DE DATOS Y REGLAS: AGENDA DE CITAS PB-009 (Equilibra TESH)
// ==============================================================================

export type EstadoCita = "pendiente" | "confirmada" | "cancelada" | "completada" | "no_asistio";

export type ModalidadCita = "presencial";

export type TipoProfesional = "psicologo" | "medico";

export type CanceladoPor = "estudiante" | "psicologo" | "medico" | "sistema";

export type AgendaBadgeType = "AUTO" | "ESTUDIANTE" | "PSICÓLOGO" | "MIXTO";

export interface SolicitudCita {
  id: string;
  folio: string;
  user_id: string;
  psicologo_id?: string | null;
  nombre_psicologo?: string;
  tipo_profesional?: TipoProfesional;
  iniciales_estudiante?: string;
  carrera_estudiante?: string;
  semestre_estudiante?: string;
  grupo_estudiante?: string;
  nivel_tamizaje?: "rojo" | "amarillo" | "verde";
  puntaje_phq9?: number;
  puntaje_gad7?: number;
  fecha_solicitud: string;
  fecha_cita: string; // YYYY-MM-DD
  hora_cita: string; // HH:mm:ss o HH:mm
  modalidad: ModalidadCita;
  estado: EstadoCita;
  motivo?: string | null;
  cancelado_por?: CanceladoPor | null;
  motivo_cancelacion?: string | null;
  email?: string;
  matricula?: string;
  nombre_estudiante?: string;
  folio_tamizaje?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HorarioSlot {
  hora: string; // "09:00"
  label: string; // "09:00"
  turno: "matutino" | "vespertino";
  ocupado?: boolean;
}

export interface PsicologoDisponible {
  id: string;
  nombre: string;
  consultorio: string;
  especialidad?: TipoProfesional;
}

export type ProfesionalDisponible = PsicologoDisponible;

/**
 * Slots L-V en 2 turnos:
 * - Matutino: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 12:00 (7 slots)
 * - Vespertino: 15:00, 15:30, 16:00, 16:30, 17:00 (5 slots)
 */
export const HORARIOS_CONFIGURADOS: HorarioSlot[] = [
  { hora: "09:00", label: "09:00", turno: "matutino" },
  { hora: "09:30", label: "09:30", turno: "matutino" },
  { hora: "10:00", label: "10:00", turno: "matutino" },
  { hora: "10:30", label: "10:30", turno: "matutino" },
  { hora: "11:00", label: "11:00", turno: "matutino" },
  { hora: "11:30", label: "11:30", turno: "matutino" },
  { hora: "12:00", label: "12:00", turno: "matutino" },
  { hora: "15:00", label: "15:00", turno: "vespertino" },
  { hora: "15:30", label: "15:30", turno: "vespertino" },
  { hora: "16:00", label: "16:00", turno: "vespertino" },
  { hora: "16:30", label: "16:30", turno: "vespertino" },
  { hora: "17:00", label: "17:00", turno: "vespertino" },
];

export const MOTIVO_MAX_LENGTH = 280;

/**
 * Días festivos oficiales (México / Calendario académico TESH)
 */
export const TESH_DIAS_FESTIVOS: Record<string, string> = {
  "2026-01-01": "Año Nuevo",
  "2026-02-02": "Día de la Constitución",
  "2026-03-16": "Natalicio de Benito Juárez",
  "2026-05-01": "Día del Trabajo",
  "2026-09-16": "Día de la Independencia",
  "2026-11-02": "Día de Muertos",
  "2026-11-16": "Revolución Mexicana",
  "2026-12-25": "Navidad",
  "2027-01-01": "Año Nuevo",
  "2027-02-01": "Día de la Constitución",
  "2027-03-15": "Natalicio de Benito Juárez",
  "2027-05-01": "Día del Trabajo",
  "2027-09-16": "Día de la Independencia",
  "2027-11-02": "Día de Muertos",
  "2027-11-15": "Revolución Mexicana",
  "2027-12-25": "Navidad",
};

export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDiaFestivo(dateOrIso: Date | string): { festivo: boolean; nombre?: string } {
  const iso = typeof dateOrIso === "string" ? dateOrIso : formatDateToISO(dateOrIso);
  const nombre = TESH_DIAS_FESTIVOS[iso];
  return nombre ? { festivo: true, nombre } : { festivo: false };
}

export function isDiaInhabilitado(date: Date): boolean {
  if (!(date instanceof Date) || isNaN(date.getTime())) return true;
  const dayOfWeek = date.getDay();
  // Fines de semana (0 = domingo, 6 = sábado)
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  // Días festivos
  if (isDiaFestivo(date).festivo) return true;
  // Días pasados respecto a hoy (local)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return candidate.getTime() < today.getTime();
}

export function formatFechaLegible(fechaIso: string): string {
  const parts = fechaIso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return fechaIso;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return fechaIso;
  const formatted = d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Valida si faltan más de 2 horas para la cita (FAIL-CLOSED).
 * Ante fecha/hora inválida o error de parseo devuelve `puedeCancelar: false`.
 */
export function verificarVentanaCancelacion(
  fechaCita: string,
  horaCita: string,
): { puedeCancelar: boolean; horasRestantes: number; mensaje?: string } {
  try {
    if (!fechaCita || !horaCita || !/^\d{4}-\d{2}-\d{2}$/.test(fechaCita)) {
      return {
        puedeCancelar: false,
        horasRestantes: 0,
        mensaje: "No es posible verificar el horario de la cita.",
      };
    }

    const horaLimpia = horaCita.trim().slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(horaLimpia)) {
      return {
        puedeCancelar: false,
        horasRestantes: 0,
        mensaje: "Formato de hora inválido para cancelar.",
      };
    }

    const [year, month, day] = fechaCita.split("-").map(Number);
    const [hours, minutes] = horaLimpia.split(":").map(Number);
    const citaDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

    if (isNaN(citaDate.getTime())) {
      return {
        puedeCancelar: false,
        horasRestantes: 0,
        mensaje: "No es posible verificar el horario de la cita.",
      };
    }

    const diffMs = citaDate.getTime() - Date.now();
    const horasRestantes = diffMs / (1000 * 60 * 60);

    if (!Number.isFinite(horasRestantes)) {
      return {
        puedeCancelar: false,
        horasRestantes: 0,
        mensaje: "No es posible verificar la ventana de cancelación.",
      };
    }

    if (horasRestantes > 2) {
      return { puedeCancelar: true, horasRestantes };
    }

    if (horasRestantes <= 0) {
      return {
        puedeCancelar: false,
        horasRestantes: 0,
        mensaje: "La fecha y hora de la cita ya han transcurrido.",
      };
    }

    return {
      puedeCancelar: false,
      horasRestantes,
      mensaje: `Faltan menos de 2 horas (${Math.max(1, Math.round(horasRestantes * 60))} min). Para cancelar con menos de 2 horas comunícate directamente con Bienestar Estudiantil.`,
    };
  } catch {
    return {
      puedeCancelar: false,
      horasRestantes: 0,
      mensaje: "No es posible cancelar en este momento.",
    };
  }
}
