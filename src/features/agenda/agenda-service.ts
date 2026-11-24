import { supabase } from "@/lib/supabase";
import {
  HORARIOS_CONFIGURADOS,
  MOTIVO_MAX_LENGTH,
  isDiaFestivo,
  type EstadoCita,
  type PsicologoDisponible,
  type SolicitudCita,
} from "./types";
import { triggerEnvioEncuesta } from "../encuesta/encuesta-service";
import {
  createAlertaInasistencia,
  findTutorForStudent,
  getAuthenticatedUid,
} from "@/features/tutor/tutor-service";

const LOCAL_STORAGE_KEY = "equilibra_solicitudes_cita_v2";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PSICOLOGOS_INSTITUCIONALES: Array<
  PsicologoDisponible & { turno: "matutino" | "vespertino" }
> = [
  {
    id: "psy-001",
    nombre: "Dra. Marta Gómez",
    consultorio: "Consultorio 3 · Edificio de Bienestar TESH",
    turno: "matutino",
  },
  {
    id: "psy-002",
    nombre: "Lic. Carlos Fuentes",
    consultorio: "Consultorio 1 · Edificio de Bienestar TESH",
    turno: "vespertino",
  },
];

// Citas iniciales sembradas para demostración interactiva inmediata:
// - Otros estudiantes ocupan algunos slots próximos (2026-11-24 / 2026-11-25) para mostrar slots ocupados
// - demo-student-dess conserva historial previo (completada, cancelada, no_asistio) sin bloquear nueva reserva
const SEED_SOLICITUDES: SolicitudCita[] = [
  {
    id: "sol-ocup-001",
    folio: "EQ-4120",
    user_id: "demo-user-student-2",
    psicologo_id: "psy-001",
    nombre_psicologo: "Dra. Marta Gómez",
    iniciales_estudiante: "M.R.",
    carrera_estudiante: "Ing. Industrial",
    semestre_estudiante: "4º Semestre",
    nivel_tamizaje: "amarillo",
    puntaje_phq9: 6,
    puntaje_gad7: 11,
    fecha_solicitud: new Date(Date.now() - 172800000).toISOString(),
    fecha_cita: "2026-11-24",
    hora_cita: "10:00",
    modalidad: "presencial",
    estado: "confirmada",
    motivo: "Seguimiento de técnicas de respiración y manejo de ansiedad.",
  },
  {
    id: "sol-ocup-002",
    folio: "EQ-5281",
    user_id: "demo-user-student-3",
    psicologo_id: "psy-001",
    nombre_psicologo: "Dra. Marta Gómez",
    iniciales_estudiante: "L.G.",
    carrera_estudiante: "Ing. Mecatrónica",
    semestre_estudiante: "5º Semestre",
    nivel_tamizaje: "verde",
    fecha_solicitud: new Date(Date.now() - 86400000).toISOString(),
    fecha_cita: "2026-11-24",
    hora_cita: "11:30",
    modalidad: "presencial",
    estado: "pendiente",
    motivo: "Orientación académica previo a evaluaciones.",
  },
  {
    id: "sol-ocup-003",
    folio: "EQ-6104",
    user_id: "demo-user-student-4",
    psicologo_id: "psy-002",
    nombre_psicologo: "Lic. Carlos Fuentes",
    iniciales_estudiante: "A.V.",
    carrera_estudiante: "Lic. en Administración",
    semestre_estudiante: "3º Semestre",
    nivel_tamizaje: "amarillo",
    fecha_solicitud: new Date(Date.now() - 86400000).toISOString(),
    fecha_cita: "2026-11-24",
    hora_cita: "15:30",
    modalidad: "presencial",
    estado: "confirmada",
    motivo: "Acompañamiento para organización de tiempo y descanso.",
  },
  {
    id: "sol-ocup-004",
    folio: "EQ-7033",
    user_id: "demo-user-student-5",
    psicologo_id: "psy-001",
    nombre_psicologo: "Dra. Marta Gómez",
    iniciales_estudiante: "J.M.",
    carrera_estudiante: "Ing. Civil",
    semestre_estudiante: "6º Semestre",
    fecha_solicitud: new Date(Date.now() - 86400000).toISOString(),
    fecha_cita: "2026-11-25",
    hora_cita: "09:30",
    modalidad: "presencial",
    estado: "confirmada",
    motivo: "Consulta inicial de orientación psicológica.",
  },
  {
    id: "sol-hist-dess-1",
    folio: "EQ-9374",
    user_id: "demo-student-dess",
    psicologo_id: "psy-001",
    nombre_psicologo: "Dra. Marta Gómez",
    iniciales_estudiante: "D.B.",
    carrera_estudiante: "Ing. en Sistemas Computacionales",
    semestre_estudiante: "5º Semestre",
    nivel_tamizaje: "amarillo",
    fecha_solicitud: "2026-11-02T10:00:00.000Z",
    fecha_cita: "2026-11-05",
    hora_cita: "11:00",
    modalidad: "presencial",
    estado: "completada",
    motivo: "Primera sesión de orientación y estrategias de estudio.",
  },
  {
    id: "sol-hist-dess-2",
    folio: "EQ-9374",
    user_id: "demo-student-dess",
    psicologo_id: "psy-002",
    nombre_psicologo: "Lic. Carlos Fuentes",
    iniciales_estudiante: "D.B.",
    carrera_estudiante: "Ing. en Sistemas Computacionales",
    semestre_estudiante: "5º Semestre",
    fecha_solicitud: "2026-10-20T09:00:00.000Z",
    fecha_cita: "2026-10-23",
    hora_cita: "15:00",
    modalidad: "presencial",
    estado: "cancelada",
    cancelado_por: "estudiante",
    motivo: "Cruce con práctica de laboratorio.",
    motivo_cancelacion: "Cancelada con anticipación por práctica de laboratorio.",
  },
  {
    id: "sol-hist-dess-3",
    folio: "EQ-9374",
    user_id: "demo-student-dess",
    psicologo_id: "psy-001",
    nombre_psicologo: "Dra. Marta Gómez",
    iniciales_estudiante: "D.B.",
    carrera_estudiante: "Ing. en Sistemas Computacionales",
    semestre_estudiante: "5º Semestre",
    fecha_solicitud: "2026-10-10T11:00:00.000Z",
    fecha_cita: "2026-10-14",
    hora_cita: "10:30",
    modalidad: "presencial",
    estado: "no_asistio",
    motivo: "Seguimiento preventivo.",
  },
];

function getLocalSolicitudes(): SolicitudCita[] {
  if (typeof window === "undefined") return SEED_SOLICITUDES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_SOLICITUDES));
      return SEED_SOLICITUDES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SolicitudCita[]) : SEED_SOLICITUDES;
  } catch {
    return SEED_SOLICITUDES;
  }
}

function saveLocalSolicitudes(list: SolicitudCita[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Normaliza una cadena de hora a formato "HH:mm" (ej. "09:00:00" -> "09:00")
 */
export function normalizarHoraSlot(h: string): string {
  if (!h) return "";
  const parts = h.trim().split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return h.trim();
}

function isFechaLaborableValida(fecha: string): { ok: boolean; error?: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { ok: false, error: "Formato de fecha inválido." };
  }
  const [y, m, d] = fecha.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  if (isNaN(dateObj.getTime())) {
    return { ok: false, error: "Fecha inválida." };
  }
  const dayOfWeek = dateObj.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { ok: false, error: "Solo se atiende de lunes a viernes." };
  }
  const festivoCheck = isDiaFestivo(fecha);
  if (festivoCheck.festivo) {
    return {
      ok: false,
      error: `El ${fecha} es día inhábil (${festivoCheck.nombre || "festivo"}).`,
    };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj.getTime() < today.getTime()) {
    return { ok: false, error: "No puedes agendar en fechas pasadas." };
  }
  return { ok: true };
}

async function getPsicologoCatalogo(): Promise<
  Array<PsicologoDisponible & { turno?: "matutino" | "vespertino" }>
> {
  try {
    let { data, error } = await supabase
      .from("profiles")
      .select("id, nombre, rol")
      .eq("rol", "psicologo")
      .order("nombre", { ascending: true });

    if (error && error.message.toLowerCase().includes("rol")) {
      const retry = await supabase
        .from("profiles")
        .select("id, nombre, role")
        .eq("role", "psicologo")
        .order("nombre", { ascending: true });
      data = retry.data as typeof data;
      error = retry.error;
    }

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((p: Record<string, unknown>, idx: number) => ({
        id: String(p.id),
        nombre: String(p.nombre || "Psicólogo Clínico TESH"),
        consultorio:
          idx % 2 === 0
            ? "Consultorio 3 · Edificio de Bienestar TESH"
            : "Consultorio 1 · Edificio de Bienestar TESH",
      }));
    }
  } catch {
    // Fallback institucional
  }

  return PSICOLOGOS_INSTITUCIONALES;
}

async function getActiveBookingsByDate(
  fecha: string,
): Promise<Array<{ hora: string; psicologo_id: string | null }>> {
  const bookings: Array<{ hora: string; psicologo_id: string | null }> = [];

  try {
    const { data, error } = await supabase
      .from("solicitudes_cita")
      .select("hora_cita, estado, psicologo_id")
      .eq("fecha_cita", fecha)
      .in("estado", ["pendiente", "confirmada"]);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row.hora_cita) {
          bookings.push({
            hora: normalizarHoraSlot(String(row.hora_cita)),
            psicologo_id: row.psicologo_id ? String(row.psicologo_id) : null,
          });
        }
      }
    }
  } catch {
    // Fallback local
  }

  const localList = getLocalSolicitudes();
  for (const c of localList) {
    if (c.fecha_cita === fecha && (c.estado === "pendiente" || c.estado === "confirmada")) {
      bookings.push({
        hora: normalizarHoraSlot(c.hora_cita),
        psicologo_id: c.psicologo_id || null,
      });
    }
  }

  return bookings;
}

/**
 * Asignación automática del psicólogo disponible para una fecha y hora específica.
 * El estudiante NO elige psicólogo; el sistema asigna al especialista libre en el turno.
 */
export async function getPsicologoDisponible(
  fecha: string,
  hora: string,
): Promise<PsicologoDisponible | null> {
  const horaNorm = normalizarHoraSlot(hora);
  const slotInfo = HORARIOS_CONFIGURADOS.find((s) => s.hora === horaNorm);
  if (!slotInfo) return null;

  const [catalogo, activeBookings] = await Promise.all([
    getPsicologoCatalogo(),
    getActiveBookingsByDate(fecha),
  ]);

  const bookingsAtSlot = activeBookings.filter((b) => b.hora === horaNorm);
  const busyPsychIds = new Set(bookingsAtSlot.map((b) => b.psicologo_id).filter(Boolean));

  // Preferir especialista del turno correspondiente si está libre
  const turnoCandidates = catalogo.filter((p) => !p.turno || p.turno === slotInfo.turno);
  const freeInTurno = turnoCandidates.find((p) => !busyPsychIds.has(p.id));
  if (freeInTurno) {
    return {
      id: freeInTurno.id,
      nombre: freeInTurno.nombre,
      consultorio: freeInTurno.consultorio,
    };
  }

  // Si hubo una reserva legacy sin psicologo_id en ese horario, respetar bloqueo
  if (bookingsAtSlot.some((b) => !b.psicologo_id)) {
    return null;
  }

  return null;
}

/**
 * Obtener solicitudes del estudiante actual
 */
export async function getSolicitudesEstudiante(
  userId: string,
  folio?: string,
): Promise<SolicitudCita[]> {
  let dbRecords: SolicitudCita[] = [];
  if (userId && UUID_REGEX.test(userId)) {
    try {
      const { data, error } = await supabase
        .from("solicitudes_cita")
        .select("*")
        .eq("user_id", userId)
        .order("fecha_cita", { ascending: false })
        .order("hora_cita", { ascending: false });

      if (!error && Array.isArray(data)) {
        const catalogo = await getPsicologoCatalogo();
        const psychMap = new Map(catalogo.map((p) => [p.id, p.nombre]));
        dbRecords = data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          folio: String(row.folio || ""),
          user_id: String(row.user_id || userId),
          psicologo_id: row.psicologo_id ? String(row.psicologo_id) : null,
          nombre_psicologo:
            (row.nombre_psicologo ? String(row.nombre_psicologo) : undefined) ||
            (row.psicologo_id ? psychMap.get(String(row.psicologo_id)) : undefined) ||
            "Dra. Marta Gómez",
          fecha_solicitud: String(
            row.fecha_solicitud || row.created_at || new Date().toISOString(),
          ),
          fecha_cita: String(row.fecha_cita || ""),
          hora_cita: normalizarHoraSlot(String(row.hora_cita || "")),
          modalidad: "presencial",
          estado: (row.estado as EstadoCita) || "pendiente",
          motivo: row.motivo ? String(row.motivo) : null,
          cancelado_por: row.cancelado_por
            ? (String(row.cancelado_por) as SolicitudCita["cancelado_por"])
            : null,
          motivo_cancelacion: row.motivo_cancelacion ? String(row.motivo_cancelacion) : null,
          created_at: row.created_at ? String(row.created_at) : undefined,
          updated_at: row.updated_at ? String(row.updated_at) : undefined,
        }));
      }
    } catch {
      // Continuar a fallback
    }
  }

  const localList = getLocalSolicitudes();
  const localOwn = localList.filter((s) => {
    if (userId && s.user_id === userId) return true;
    if (folio && s.folio === folio) return true;
    return false;
  });

  const dbIds = new Set(dbRecords.map((r) => r.id));
  const combined = [...dbRecords, ...localOwn.filter((l) => !dbIds.has(l.id))];

  return combined.sort((a, b) => {
    const da = new Date(`${a.fecha_cita}T${normalizarHoraSlot(a.hora_cita) || "00:00"}`).getTime();
    const db = new Date(`${b.fecha_cita}T${normalizarHoraSlot(b.hora_cita) || "00:00"}`).getTime();
    return db - da;
  });
}

/**
 * Obtener solicitudes para el panel del psicólogo con filtros
 */
export async function getSolicitudesPsicologo(filtros?: {
  fecha?: string;
  estado?: EstadoCita;
}): Promise<SolicitudCita[]> {
  try {
    let query = supabase
      .from("solicitudes_cita")
      .select("*")
      .order("fecha_cita", { ascending: true })
      .order("hora_cita", { ascending: true });

    if (filtros?.fecha) {
      query = query.eq("fecha_cita", filtros.fecha);
    }
    if (filtros?.estado) {
      query = query.eq("estado", filtros.estado);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return data as SolicitudCita[];
    }
  } catch {
    // Continuar a fallback
  }

  let list = getLocalSolicitudes();
  if (filtros?.fecha) {
    list = list.filter((s) => s.fecha_cita === filtros.fecha);
  }
  if (filtros?.estado) {
    list = list.filter((s) => s.estado === filtros.estado);
  }
  return list;
}

/**
 * Obtener las horas ya ocupadas para una fecha dada desde Supabase y localStorage
 * (PB-009: Bloqueo de horas ocupadas y prevención de doble reserva en tiempo real).
 */
export async function getCitasOcupadasPorFecha(
  fecha: string,
  psicologoId?: string,
): Promise<string[]> {
  const activeBookings = await getActiveBookingsByDate(fecha);
  const horasSet = new Set<string>();

  if (psicologoId) {
    for (const b of activeBookings) {
      if (!b.psicologo_id || b.psicologo_id === psicologoId) {
        horasSet.add(b.hora);
      }
    }
    return Array.from(horasSet);
  }

  // Sin psicologoId explícito: verificar disponibilidad real por turno/psicólogo
  const catalogo = await getPsicologoCatalogo();
  for (const slot of HORARIOS_CONFIGURADOS) {
    const bookingsAtSlot = activeBookings.filter((b) => b.hora === slot.hora);
    if (bookingsAtSlot.length === 0) continue;

    if (bookingsAtSlot.some((b) => !b.psicologo_id)) {
      horasSet.add(slot.hora);
      continue;
    }

    const busyIds = new Set(bookingsAtSlot.map((b) => b.psicologo_id));
    const turnoCandidates = catalogo.filter((p) => !p.turno || p.turno === slot.turno);
    const hasFree = turnoCandidates.some((p) => !busyIds.has(p.id));
    if (!hasFree) {
      horasSet.add(slot.hora);
    }
  }

  return Array.from(horasSet);
}

/**
 * Crear nueva solicitud de cita con validación cliente+servidor, asignación automática
 * de psicólogo (getPsicologoDisponible) y constraint UNIQUE (psicologo_id + fecha + hora).
 */
export async function crearSolicitudCita(
  solicitud: Omit<SolicitudCita, "id" | "fecha_solicitud" | "created_at" | "updated_at">,
): Promise<{ ok: boolean; cita?: SolicitudCita; error?: string }> {
  // 1. Validación estricta de fecha laborable (no fines de semana ni festivos)
  const fechaCheck = isFechaLaborableValida(solicitud.fecha_cita);
  if (!fechaCheck.ok) {
    return { ok: false, error: fechaCheck.error };
  }

  // 2. Validación de horario permitido (7 matutino + 5 vespertino)
  const horaNormalizada = normalizarHoraSlot(solicitud.hora_cita);
  const slotValido = HORARIOS_CONFIGURADOS.some((s) => s.hora === horaNormalizada);
  if (!slotValido) {
    return {
      ok: false,
      error: "El horario seleccionado no corresponde a los turnos institucionales permitidos.",
    };
  }

  // 3. Validación de motivo <= 280 caracteres
  const motivoLimpio = solicitud.motivo?.trim() || "";
  if (motivoLimpio.length > MOTIVO_MAX_LENGTH) {
    return {
      ok: false,
      error: `El motivo no puede exceder ${MOTIVO_MAX_LENGTH} caracteres.`,
    };
  }

  // 4. Validar límite de 1 cita activa por estudiante
  const existentes = await getSolicitudesEstudiante(solicitud.user_id, solicitud.folio);
  const activa = existentes.find((c) => c.estado === "pendiente" || c.estado === "confirmada");
  if (activa) {
    return {
      ok: false,
      error: `Ya cuentas con una cita activa el ${activa.fecha_cita} a las ${activa.hora_cita} hrs. Solo se permite una cita activa a la vez.`,
    };
  }

  // 5. Asignación automática del psicólogo disponible (el estudiante no lo elige)
  const psicologoAsignado = await getPsicologoDisponible(solicitud.fecha_cita, horaNormalizada);
  if (!psicologoAsignado) {
    return {
      ok: false,
      error: `El horario de las ${horaNormalizada} hrs para el ${solicitud.fecha_cita} ya fue reservado. Selecciona otro horario disponible.`,
    };
  }

  // 6. Doble verificación UNIQUE (psicologo_id + fecha_cita + hora_cita)
  const activeBookings = await getActiveBookingsByDate(solicitud.fecha_cita);
  const conflict = activeBookings.some(
    (b) =>
      b.hora === horaNormalizada &&
      (b.psicologo_id === psicologoAsignado.id || b.psicologo_id === null),
  );
  if (conflict) {
    return {
      ok: false,
      error:
        "Ese horario acaba de ser reservado por otro estudiante. Por favor elige otro horario.",
    };
  }

  const nuevaCita: SolicitudCita = {
    ...solicitud,
    psicologo_id: psicologoAsignado.id,
    nombre_psicologo: psicologoAsignado.nombre,
    hora_cita: horaNormalizada,
    id: `sol-${Date.now().toString(36)}`,
    fecha_solicitud: new Date().toISOString(),
    modalidad: "presencial",
    estado: "pendiente",
    motivo: motivoLimpio || null,
  };

  const authUid = await getAuthenticatedUid();
  if (authUid || UUID_REGEX.test(solicitud.user_id)) {
    try {
      const dbUserId = authUid || solicitud.user_id;
      const dbPsychId = UUID_REGEX.test(psicologoAsignado.id) ? psicologoAsignado.id : null;
      const { data, error } = await supabase
        .from("solicitudes_cita")
        .insert({
          folio: nuevaCita.folio,
          user_id: dbUserId,
          psicologo_id: dbPsychId,
          fecha_cita: nuevaCita.fecha_cita,
          hora_cita: nuevaCita.hora_cita,
          modalidad: "presencial",
          estado: "pendiente",
          motivo: nuevaCita.motivo,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505" || error.message.toLowerCase().includes("unique")) {
          return {
            ok: false,
            error: "Ese horario ya fue reservado en el servidor (restricción única de agenda).",
          };
        }
        return { ok: false, error: error.message };
      }

      if (data) {
        nuevaCita.id = String(data.id);
      }
    } catch {
      // Fallback local si no hay conexión
    }
  }

  const localList = getLocalSolicitudes();
  saveLocalSolicitudes([nuevaCita, ...localList]);

  return { ok: true, cita: nuevaCita };
}

/**
 * Cancelar cita por el estudiante (validación estricta fail-closed > 2h de anticipación)
 */
export async function cancelarCitaEstudiante(
  citaId: string,
  fechaCita: string,
  horaCita: string,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { verificarVentanaCancelacion } = await import("./types");
  const check = verificarVentanaCancelacion(fechaCita, horaCita);
  if (!check.puedeCancelar) {
    return {
      ok: false,
      error:
        check.mensaje || "La cita solo puede cancelarse cuando faltan más de 2 horas para iniciar.",
    };
  }

  if (UUID_REGEX.test(citaId)) {
    try {
      const { error } = await supabase
        .from("solicitudes_cita")
        .update({
          estado: "cancelada",
          cancelado_por: "estudiante",
          motivo_cancelacion: motivo || "Cancelada por el estudiante vía portal",
          updated_at: new Date().toISOString(),
        })
        .eq("id", citaId);
      if (error) {
        return { ok: false, error: error.message };
      }
    } catch {
      // Continuar local
    }
  }

  const localList = getLocalSolicitudes();
  const index = localList.findIndex((c) => c.id === citaId);
  if (index !== -1) {
    localList[index] = {
      ...localList[index],
      estado: "cancelada",
      cancelado_por: "estudiante",
      motivo_cancelacion: motivo || "Cancelada por el estudiante vía portal",
    };
    saveLocalSolicitudes(localList);
  }

  return { ok: true };
}

/**
 * Actualizar estado de cita por el psicólogo (Aceptar / Cancelar / Completar / No asistió)
 * Reglas de negocio:
 * 1. 'completada' -> Disparador PB-021 Encuesta de Alta Clínica (ventana 24h)
 * 2. 2 inasistencias consecutivas 'no_asistio' -> Disparador PB-021 Encuesta de Abandono (ventana 15 días)
 */
export async function actualizarEstadoCitaPsicologo(
  citaId: string,
  nuevoEstado: EstadoCita,
  motivoCancelacion?: string,
): Promise<{ ok: boolean; triggerEncuestaAbandono: boolean; triggerEncuestaAlta?: boolean }> {
  let triggerEncuestaAbandono = false;
  let triggerEncuestaAlta = false;

  const localList = getLocalSolicitudes();
  let targetCita: SolicitudCita | undefined = localList.find((c) => c.id === citaId);

  try {
    const updatePayload: Record<string, unknown> = {
      estado: nuevoEstado,
      updated_at: new Date().toISOString(),
    };

    if (nuevoEstado === "cancelada") {
      updatePayload.cancelado_por = "psicologo";
      updatePayload.motivo_cancelacion =
        motivoCancelacion || "Cancelada por el psicólogo por causas de fuerza mayor";
    }

    const { data } = await supabase
      .from("solicitudes_cita")
      .update(updatePayload)
      .eq("id", citaId)
      .select()
      .maybeSingle();

    if (data && !targetCita) {
      targetCita = data as SolicitudCita;
    }
  } catch {
    // Continuar local
  }

  const index = localList.findIndex((c) => c.id === citaId);
  if (index !== -1) {
    const target = localList[index];
    localList[index] = {
      ...target,
      estado: nuevoEstado,
      cancelado_por: nuevoEstado === "cancelada" ? "psicologo" : target.cancelado_por,
      motivo_cancelacion:
        nuevoEstado === "cancelada"
          ? motivoCancelacion || "Cancelada por el psicólogo"
          : target.motivo_cancelacion,
    };
    targetCita = localList[index];
    saveLocalSolicitudes(localList);
  }

  // DISPARADORES AUTOMÁTICOS PB-021 (MIN-008):
  // 1. Alta clínica (cita completada) -> enlace en ventana de 24h
  if (nuevoEstado === "completada" && targetCita) {
    triggerEncuestaAlta = true;
    try {
      await triggerEnvioEncuesta({
        folio: targetCita.folio,
        user_id: targetCita.user_id,
        trigger_tipo: "alta",
        email: targetCita.email,
        nombre: targetCita.nombre_estudiante || targetCita.iniciales_estudiante,
      });
    } catch (err) {
      console.error("Error al disparar PB-021 Alta:", err);
    }
  }

  // 2. Abandono (2 inasistencias consecutivas 'no_asistio') -> ventana de 15 días + Alerta automática al tutor
  if (nuevoEstado === "no_asistio" && targetCita) {
    let citasDelEstudiante: Array<{ estado: string; fecha_cita: string; hora_cita?: string }> =
      localList.filter(
        (c) =>
          (targetCita?.folio && c.folio === targetCita.folio) ||
          (targetCita?.user_id && c.user_id === targetCita.user_id),
      );

    try {
      let dbQuery = supabase
        .from("solicitudes_cita")
        .select("id, estado, fecha_cita, hora_cita, folio, user_id");

      if (targetCita.user_id && /^[0-9a-f-]{36}$/i.test(targetCita.user_id)) {
        dbQuery = dbQuery.eq("user_id", targetCita.user_id);
      } else if (targetCita.folio) {
        dbQuery = dbQuery.eq("folio", targetCita.folio);
      }

      const { data: dbCitas } = await dbQuery;
      if (Array.isArray(dbCitas) && dbCitas.length > 0) {
        citasDelEstudiante = dbCitas as typeof citasDelEstudiante;
      }
    } catch {
      // Continuar con lista local
    }

    citasDelEstudiante = [...citasDelEstudiante].sort(
      (a, b) =>
        new Date(`${b.fecha_cita}T${b.hora_cita || "00:00"}`).getTime() -
        new Date(`${a.fecha_cita}T${a.hora_cita || "00:00"}`).getTime(),
    );

    const esInasistenciaConsecutiva =
      citasDelEstudiante.length >= 2 &&
      citasDelEstudiante[0].estado === "no_asistio" &&
      citasDelEstudiante[1].estado === "no_asistio";

    if (esInasistenciaConsecutiva) {
      triggerEncuestaAbandono = true;
      try {
        await triggerEnvioEncuesta({
          folio: targetCita.folio,
          user_id: targetCita.user_id,
          trigger_tipo: "abandono",
          email: targetCita.email,
          nombre: targetCita.nombre_estudiante || targetCita.iniciales_estudiante,
        });
      } catch (err) {
        console.error("Error al disparar PB-021 Abandono:", err);
      }
    }

    try {
      const tutorMatch = await findTutorForStudent({
        estudianteId: targetCita.user_id,
        carrera: targetCita.carrera_estudiante,
      });

      if (tutorMatch?.tutor_id) {
        const psicologoUid = (await getAuthenticatedUid()) || targetCita.psicologo_id || null;
        const tipoAlerta = esInasistenciaConsecutiva ? "inasistencia_repetida" : "no_asistio";
        const prioridad = esInasistenciaConsecutiva ? "urgente" : "alta";
        const folioTexto = targetCita.folio || targetCita.iniciales_estudiante || "Estudiante";
        const mensaje = esInasistenciaConsecutiva
          ? `Estudiante ${folioTexto} acumuló 2 inasistencias consecutivas a cita (${targetCita.fecha_cita}). Requiere seguimiento urgente.`
          : `Estudiante ${folioTexto} no asistió a su cita programada el ${targetCita.fecha_cita}.`;

        await createAlertaInasistencia({
          tutor_id: tutorMatch.tutor_id,
          psicologo_id: psicologoUid,
          estudiante_id: targetCita.user_id,
          folio: targetCita.folio,
          tipo_alerta: tipoAlerta,
          prioridad,
          mensaje,
        });
      }
    } catch (alertErr) {
      console.warn("Aviso al crear alerta de inasistencia para tutor:", alertErr);
    }
  }

  return { ok: true, triggerEncuestaAbandono, triggerEncuestaAlta };
}
