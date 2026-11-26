import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DEMO_MODE } from "@/lib/mock-data";
import {
  HORARIOS_CONFIGURADOS,
  MOTIVO_MAX_LENGTH,
  isDiaFestivo,
  type EstadoCita,
  type ProfesionalDisponible,
  type PsicologoDisponible,
  type SolicitudCita,
  type TipoProfesional,
} from "./types";
import { triggerEnvioEncuesta } from "../encuesta/encuesta-service";
import {
  createAlertaInasistencia,
  findTutorForStudent,
  getAuthenticatedUid,
} from "@/features/tutor/tutor-service";

const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;
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
    especialidad: "psicologo",
  },
  {
    id: "psy-002",
    nombre: "Lic. Carlos Fuentes",
    consultorio: "Consultorio 1 · Edificio de Bienestar TESH",
    turno: "vespertino",
    especialidad: "psicologo",
  },
];

const MEDICOS_INSTITUCIONALES: Array<ProfesionalDisponible & { turno: "matutino" | "vespertino" }> =
  [
    {
      id: "demo-medico-alejandro",
      nombre: "Dr. Alejandro Vega",
      consultorio: "Consultorio Médico 1 · Servicio Médico TESH",
      turno: "matutino",
      especialidad: "medico",
    },
    {
      id: "med-002",
      nombre: "Dra. Sofía Castellanos",
      consultorio: "Consultorio Médico 2 · Servicio Médico TESH",
      turno: "vespertino",
      especialidad: "medico",
    },
  ];

// Citas iniciales sembradas para demostración interactiva inmediata:
// - Las agendas de Psicología y Servicio Médico se mantienen aisladas por `tipo_profesional`.
const SEED_SOLICITUDES: SolicitudCita[] = [
  {
    id: "sol-ocup-001",
    folio: "EQ-4120",
    user_id: "demo-user-student-2",
    psicologo_id: "psy-001",
    nombre_psicologo: "Dra. Marta Gómez",
    tipo_profesional: "psicologo",
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
    tipo_profesional: "psicologo",
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
    tipo_profesional: "psicologo",
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
    tipo_profesional: "psicologo",
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
    tipo_profesional: "psicologo",
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
    tipo_profesional: "psicologo",
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
    tipo_profesional: "psicologo",
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
  // Citas del Servicio Médico TESH (sin datos de tamizaje ni semáforo por LFPDPPP)
  {
    id: "sol-med-001",
    folio: "MED-1041",
    user_id: "demo-student-isc-2",
    psicologo_id: "demo-medico-alejandro",
    nombre_psicologo: "Dr. Alejandro Vega",
    tipo_profesional: "medico",
    iniciales_estudiante: "V.M.",
    nombre_estudiante: "Valeria Morales",
    matricula: "202310489",
    carrera_estudiante: "Ing. en Sistemas Computacionales",
    semestre_estudiante: "5º Semestre",
    grupo_estudiante: "501",
    fecha_solicitud: new Date(Date.now() - 86400000).toISOString(),
    fecha_cita: "2026-11-25",
    hora_cita: "10:00",
    modalidad: "presencial",
    estado: "confirmada",
    motivo: "Cefaleas tensionales matutinas e insomnio persistente desde hace 2 semanas.",
  },
  {
    id: "sol-med-002",
    folio: "MED-1042",
    user_id: "demo-student-isc-3",
    psicologo_id: "demo-medico-alejandro",
    nombre_psicologo: "Dr. Alejandro Vega",
    tipo_profesional: "medico",
    iniciales_estudiante: "D.H.",
    nombre_estudiante: "Diego Hernández",
    matricula: "202310511",
    carrera_estudiante: "Ing. en Sistemas Computacionales",
    semestre_estudiante: "5º Semestre",
    grupo_estudiante: "501",
    fecha_solicitud: new Date(Date.now() - 43200000).toISOString(),
    fecha_cita: "2026-11-25",
    hora_cita: "11:30",
    modalidad: "presencial",
    estado: "pendiente",
    motivo: "Fatiga crónica, mareos ocasionales y molestias gástricas antes de clases.",
  },
  {
    id: "sol-med-003",
    folio: "MED-1043",
    user_id: "demo-student-ind-302-1",
    psicologo_id: "demo-medico-alejandro",
    nombre_psicologo: "Dr. Alejandro Vega",
    tipo_profesional: "medico",
    iniciales_estudiante: "A.T.",
    nombre_estudiante: "Alejandro Torres",
    matricula: "202410218",
    carrera_estudiante: "Ing. Industrial",
    semestre_estudiante: "3º Semestre",
    grupo_estudiante: "302",
    fecha_solicitud: new Date(Date.now() - 21600000).toISOString(),
    fecha_cita: "2026-11-26",
    hora_cita: "09:30",
    modalidad: "presencial",
    estado: "confirmada",
    motivo: "Valoración por falta de apetito y cansancio físico generalizado.",
  },
  {
    id: "sol-med-004",
    folio: "MED-1038",
    user_id: "demo-student-isc-601-1",
    psicologo_id: "med-002",
    nombre_psicologo: "Dra. Sofía Castellanos",
    tipo_profesional: "medico",
    iniciales_estudiante: "F.L.",
    nombre_estudiante: "Fernanda López",
    matricula: "202210301",
    carrera_estudiante: "Ing. en Sistemas Computacionales",
    semestre_estudiante: "6º Semestre",
    grupo_estudiante: "601",
    fecha_solicitud: new Date(Date.now() - 86400000 * 5).toISOString(),
    fecha_cita: "2026-11-20",
    hora_cita: "15:30",
    modalidad: "presencial",
    estado: "completada",
    motivo: "Revisión de signos vitales y cefalea por desvelo prolongado.",
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
    if (!Array.isArray(parsed)) return SEED_SOLICITUDES;
    const list = parsed as SolicitudCita[];
    // Asegurar que las semillas médicas nuevas se fusionen si localStorage ya existía de antes
    const existingIds = new Set(list.map((item) => item.id));
    const missingMedicalSeeds = SEED_SOLICITUDES.filter(
      (s) => s.tipo_profesional === "medico" && !existingIds.has(s.id),
    );
    if (missingMedicalSeeds.length > 0) {
      const merged = [...list, ...missingMedicalSeeds];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
    return list;
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

async function getProfesionalCatalogo(
  tipo: TipoProfesional = "psicologo",
): Promise<Array<ProfesionalDisponible & { turno?: "matutino" | "vespertino" }>> {
  let { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, rol")
    .eq("rol", tipo)
    .order("nombre", { ascending: true });

  if (error && error.message.toLowerCase().includes("rol")) {
    const retry = await supabase
      .from("profiles")
      .select("id, nombre, role")
      .eq("role", tipo)
      .order("nombre", { ascending: true });
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (USE_LIVE_SUPABASE) {
    if (error) {
      throw new Error(error.message);
    }
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    return data.map((p: Record<string, unknown>, idx: number) => ({
      id: String(p.id),
      nombre: String(
        p.nombre || (tipo === "medico" ? "Médico Universitario TESH" : "Psicólogo Clínico TESH"),
      ),
      consultorio:
        tipo === "medico"
          ? idx % 2 === 0
            ? "Consultorio Médico 1 · Servicio Médico TESH"
            : "Consultorio Médico 2 · Servicio Médico TESH"
          : idx % 2 === 0
            ? "Consultorio 3 · Edificio de Bienestar TESH"
            : "Consultorio 1 · Edificio de Bienestar TESH",
      turno: data.length > 1 ? (idx % 2 === 0 ? "matutino" : "vespertino") : undefined,
      especialidad: tipo,
    }));
  }

  if (!error && Array.isArray(data) && data.length > 0) {
    return data.map((p: Record<string, unknown>, idx: number) => ({
      id: String(p.id),
      nombre: String(
        p.nombre || (tipo === "medico" ? "Médico Universitario TESH" : "Psicólogo Clínico TESH"),
      ),
      consultorio:
        tipo === "medico"
          ? idx % 2 === 0
            ? "Consultorio Médico 1 · Servicio Médico TESH"
            : "Consultorio Médico 2 · Servicio Médico TESH"
          : idx % 2 === 0
            ? "Consultorio 3 · Edificio de Bienestar TESH"
            : "Consultorio 1 · Edificio de Bienestar TESH",
      turno: data.length > 1 ? (idx % 2 === 0 ? "matutino" : "vespertino") : undefined,
      especialidad: tipo,
    }));
  }

  return tipo === "medico" ? MEDICOS_INSTITUCIONALES : PSICOLOGOS_INSTITUCIONALES;
}

async function getActiveBookingsByDate(
  fecha: string,
  tipo: TipoProfesional = "psicologo",
): Promise<Array<{ hora: string; psicologo_id: string | null }>> {
  const bookings: Array<{ hora: string; psicologo_id: string | null }> = [];

  let { data, error } = await supabase
    .from("solicitudes_cita")
    .select("hora_cita, estado, psicologo_id, tipo_profesional")
    .eq("fecha_cita", fecha)
    .in("estado", ["pendiente", "confirmada"]);

  if (error && error.message.toLowerCase().includes("tipo_profesional")) {
    const retry = await supabase
      .from("solicitudes_cita")
      .select("hora_cita, estado, psicologo_id")
      .eq("fecha_cita", fecha)
      .in("estado", ["pendiente", "confirmada"]);
    data = retry.data as typeof data;
    error = retry.error;
  }

  if (USE_LIVE_SUPABASE && error) {
    throw new Error(error.message);
  }

  if (!error && Array.isArray(data)) {
    for (const row of data as Array<Record<string, unknown>>) {
      const rowTipo: TipoProfesional = row.tipo_profesional === "medico" ? "medico" : "psicologo";
      if (rowTipo !== tipo) continue;
      if (row.hora_cita) {
        bookings.push({
          hora: normalizarHoraSlot(String(row.hora_cita)),
          psicologo_id: row.psicologo_id ? String(row.psicologo_id) : null,
        });
      }
    }
  }

  if (USE_LIVE_SUPABASE) {
    return bookings;
  }

  const localList = getLocalSolicitudes();
  for (const c of localList) {
    const cTipo: TipoProfesional = c.tipo_profesional === "medico" ? "medico" : "psicologo";
    if (
      cTipo === tipo &&
      c.fecha_cita === fecha &&
      (c.estado === "pendiente" || c.estado === "confirmada")
    ) {
      bookings.push({
        hora: normalizarHoraSlot(c.hora_cita),
        psicologo_id: c.psicologo_id || null,
      });
    }
  }

  return bookings;
}

/**
 * Asignación automática del profesional disponible (psicólogo o médico universitario)
 * para una fecha, hora y especialidad específica.
 */
export async function getProfesionalDisponible(
  fecha: string,
  hora: string,
  tipo: TipoProfesional = "psicologo",
): Promise<ProfesionalDisponible | null> {
  const horaNorm = normalizarHoraSlot(hora);
  const slotInfo = HORARIOS_CONFIGURADOS.find((s) => s.hora === horaNorm);
  if (!slotInfo) return null;

  const [catalogo, activeBookings] = await Promise.all([
    getProfesionalCatalogo(tipo),
    getActiveBookingsByDate(fecha, tipo),
  ]);

  const bookingsAtSlot = activeBookings.filter((b) => b.hora === horaNorm);
  const busyProfIds = new Set(bookingsAtSlot.map((b) => b.psicologo_id).filter(Boolean));

  const turnoCandidates = catalogo.filter((p) => !p.turno || p.turno === slotInfo.turno);
  const freeInTurno = turnoCandidates.find((p) => !busyProfIds.has(p.id));
  if (freeInTurno) {
    return {
      id: freeInTurno.id,
      nombre: freeInTurno.nombre,
      consultorio: freeInTurno.consultorio,
      especialidad: tipo,
    };
  }

  if (bookingsAtSlot.some((b) => !b.psicologo_id)) {
    return null;
  }

  return null;
}

/**
 * Asignación automática del psicólogo disponible para una fecha y hora específica.
 */
export async function getPsicologoDisponible(
  fecha: string,
  hora: string,
): Promise<PsicologoDisponible | null> {
  return getProfesionalDisponible(fecha, hora, "psicologo");
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
    const { data, error } = await supabase
      .from("solicitudes_cita")
      .select("*")
      .eq("user_id", userId)
      .order("fecha_cita", { ascending: false })
      .order("hora_cita", { ascending: false });

    if (USE_LIVE_SUPABASE && error) {
      throw new Error(error.message);
    }

    if (!error && Array.isArray(data)) {
      const [psychCat, medCat] = await Promise.all([
        getProfesionalCatalogo("psicologo"),
        getProfesionalCatalogo("medico"),
      ]);
      const profMap = new Map([...psychCat, ...medCat].map((p) => [p.id, p.nombre]));

      dbRecords = data.map((row: Record<string, unknown>) => {
        const tipoProf: TipoProfesional =
          row.tipo_profesional === "medico" ? "medico" : "psicologo";
        return {
          id: String(row.id),
          folio: String(row.folio || ""),
          user_id: String(row.user_id || userId),
          psicologo_id: row.psicologo_id ? String(row.psicologo_id) : null,
          tipo_profesional: tipoProf,
          nombre_psicologo:
            (row.nombre_psicologo ? String(row.nombre_psicologo) : undefined) ||
            (row.psicologo_id ? profMap.get(String(row.psicologo_id)) : undefined) ||
            (tipoProf === "medico" ? "Médico Universitario TESH" : "Psicólogo Clínico TESH"),
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
        };
      });
    }
  }

  if (USE_LIVE_SUPABASE) {
    return dbRecords.sort((a, b) => {
      const da = new Date(
        `${a.fecha_cita}T${normalizarHoraSlot(a.hora_cita) || "00:00"}`,
      ).getTime();
      const db = new Date(
        `${b.fecha_cita}T${normalizarHoraSlot(b.hora_cita) || "00:00"}`,
      ).getTime();
      return db - da;
    });
  }

  const localList = getLocalSolicitudes();
  const localOwn = localList
    .filter((s) => {
      if (userId && s.user_id === userId) return true;
      if (folio && s.folio === folio) return true;
      return false;
    })
    .map((s) => ({
      ...s,
      tipo_profesional: (s.tipo_profesional === "medico"
        ? "medico"
        : "psicologo") as TipoProfesional,
    }));

  const dbIds = new Set(dbRecords.map((r) => r.id));
  const combined = [...dbRecords, ...localOwn.filter((l) => !dbIds.has(l.id))];

  return combined.sort((a, b) => {
    const da = new Date(`${a.fecha_cita}T${normalizarHoraSlot(a.hora_cita) || "00:00"}`).getTime();
    const db = new Date(`${b.fecha_cita}T${normalizarHoraSlot(b.hora_cita) || "00:00"}`).getTime();
    return db - da;
  });
}

/**
 * Obtener solicitudes exclusivas del área de psicología (filtra fuera tipo_profesional = 'medico')
 */
export async function getSolicitudesPsicologo(filtros?: {
  fecha?: string;
  estado?: EstadoCita;
}): Promise<SolicitudCita[]> {
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

  if (USE_LIVE_SUPABASE && error) {
    throw new Error(error.message);
  }

  if (!error && Array.isArray(data)) {
    const psychRows = (data as Array<Record<string, unknown>>).filter(
      (row) => (row.tipo_profesional || "psicologo") === "psicologo",
    );

    if (psychRows.length === 0) {
      if (USE_LIVE_SUPABASE) return [];
    } else {
      const userIds = Array.from(
        new Set(
          psychRows
            .map((r) => (r.user_id ? String(r.user_id) : ""))
            .filter((id) => UUID_REGEX.test(id)),
        ),
      );
      const folios = Array.from(
        new Set(
          psychRows
            .map((r) => (r.folio ? String(r.folio).trim() : ""))
            .filter((f) => f.startsWith("EQ-")),
        ),
      );

      const profMap = new Map<
        string,
        { nombre?: string; matricula?: string; carrera?: string; semestre?: string; grupo?: string }
      >();
      const tamizMap = new Map<
        string,
        { nivel?: string; phq9?: number | null; gad7?: number | null }
      >();

      const [psychCat, profsRes, tamizRes] = await Promise.all([
        getProfesionalCatalogo("psicologo").catch(() => []),
        userIds.length > 0
          ? supabase
              .from("profiles")
              .select("id, nombre, matricula, carrera, semestre, grupo")
              .in("id", userIds)
          : Promise.resolve({ data: null, error: null }),
        folios.length > 0
          ? supabase
              .from("para_psicologo")
              .select("folio, ultimo_nivel, phq9_total, gad7_total")
              .in("folio", folios)
          : Promise.resolve({ data: null, error: null }),
      ]);

      const psyNameMap = new Map(psychCat.map((p) => [p.id, p.nombre]));

      if (Array.isArray(profsRes.data)) {
        for (const p of profsRes.data as Array<Record<string, unknown>>) {
          profMap.set(String(p.id), {
            nombre: p.nombre ? String(p.nombre) : undefined,
            matricula: p.matricula ? String(p.matricula) : undefined,
            carrera: p.carrera ? String(p.carrera) : undefined,
            semestre: p.semestre ? String(p.semestre) : undefined,
            grupo: p.grupo ? String(p.grupo) : undefined,
          });
        }
      }

      if (Array.isArray(tamizRes.data)) {
        for (const t of tamizRes.data as Array<Record<string, unknown>>) {
          if (t.folio) {
            tamizMap.set(String(t.folio), {
              nivel: t.ultimo_nivel ? String(t.ultimo_nivel).toLowerCase() : undefined,
              phq9: typeof t.phq9_total === "number" ? t.phq9_total : null,
              gad7: typeof t.gad7_total === "number" ? t.gad7_total : null,
            });
          }
        }
      }

      return psychRows.map((row) => {
        const uid = String(row.user_id || "");
        const stProf = profMap.get(uid);
        const folioStr = String(row.folio || "");
        const tamiz = tamizMap.get(folioStr);
        const nombreSt =
          (row.nombre_estudiante ? String(row.nombre_estudiante) : undefined) ||
          stProf?.nombre ||
          "Estudiante TESH";
        const iniciales =
          (row.iniciales_estudiante ? String(row.iniciales_estudiante) : undefined) ||
          nombreSt
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => `${part[0]?.toUpperCase() || ""}.`)
            .join("") ||
          "E.T.";
        const nivelRaw = (tamiz?.nivel ||
          (row.nivel_tamizaje ? String(row.nivel_tamizaje).toLowerCase() : undefined)) as
          SolicitudCita["nivel_tamizaje"] | undefined;

        return {
          id: String(row.id),
          folio: folioStr,
          user_id: uid,
          psicologo_id: row.psicologo_id ? String(row.psicologo_id) : null,
          nombre_psicologo:
            (row.nombre_psicologo ? String(row.nombre_psicologo) : undefined) ||
            (row.psicologo_id ? psyNameMap.get(String(row.psicologo_id)) : undefined) ||
            "Psicólogo Clínico TESH",
          tipo_profesional: "psicologo",
          nombre_estudiante: nombreSt,
          iniciales_estudiante: iniciales,
          matricula: (row.matricula ? String(row.matricula) : undefined) || stProf?.matricula,
          carrera_estudiante:
            (row.carrera_estudiante ? String(row.carrera_estudiante) : undefined) ||
            stProf?.carrera,
          semestre_estudiante:
            (row.semestre_estudiante ? String(row.semestre_estudiante) : undefined) ||
            stProf?.semestre,
          grupo_estudiante:
            (row.grupo_estudiante ? String(row.grupo_estudiante) : undefined) || stProf?.grupo,
          email: row.email ? String(row.email) : undefined,
          nivel_tamizaje: nivelRaw,
          puntaje_phq9:
            tamiz?.phq9 ?? (typeof row.puntaje_phq9 === "number" ? row.puntaje_phq9 : undefined),
          puntaje_gad7:
            tamiz?.gad7 ?? (typeof row.puntaje_gad7 === "number" ? row.puntaje_gad7 : undefined),
          folio_tamizaje: folioStr.startsWith("EQ-") ? folioStr : undefined,
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
        };
      });
    }
  }

  let list = getLocalSolicitudes().filter(
    (s) => (s.tipo_profesional || "psicologo") === "psicologo",
  );
  if (filtros?.fecha) {
    list = list.filter((s) => s.fecha_cita === filtros.fecha);
  }
  if (filtros?.estado) {
    list = list.filter((s) => s.estado === filtros.estado);
  }
  return list;
}

/**
 * Obtener solicitudes exclusivas del Médico Universitario (LFPDPPP: sin puntajes de tamizaje,
 * sin semáforo y sin folio clínico de psicología).
 */
export async function getSolicitudesMedico(filtros?: {
  medicoId?: string;
  fecha?: string;
  estado?: EstadoCita;
}): Promise<SolicitudCita[]> {
  const sanitizeForMedico = (c: SolicitudCita): SolicitudCita => {
    const {
      nivel_tamizaje: _nivel,
      puntaje_phq9: _phq9,
      puntaje_gad7: _gad7,
      folio_tamizaje: _folioTamizaje,
      ...rest
    } = c;
    void _nivel;
    void _phq9;
    void _gad7;
    void _folioTamizaje;
    return {
      ...rest,
      tipo_profesional: "medico",
    };
  };

  let dbRecords: SolicitudCita[] = [];
  let query = supabase
    .from("solicitudes_cita")
    .select(
      "id, folio, user_id, email, matricula, psicologo_id, tipo_profesional, fecha_solicitud, fecha_cita, hora_cita, modalidad, estado, motivo, cancelado_por, motivo_cancelacion, created_at, updated_at",
    )
    .eq("tipo_profesional", "medico")
    .order("fecha_cita", { ascending: true })
    .order("hora_cita", { ascending: true });

  if (filtros?.fecha) {
    query = query.eq("fecha_cita", filtros.fecha);
  }
  if (filtros?.estado) {
    query = query.eq("estado", filtros.estado);
  }

  const { data, error } = await query;

  if (USE_LIVE_SUPABASE && error) {
    throw new Error(error.message);
  }

  if (!error && Array.isArray(data) && data.length > 0) {
    const userIds = Array.from(
      new Set(
        data
          .map((r: Record<string, unknown>) => (r.user_id ? String(r.user_id) : ""))
          .filter((id) => UUID_REGEX.test(id)),
      ),
    );
    const profMap = new Map<
      string,
      { nombre?: string; matricula?: string; carrera?: string; semestre?: string; grupo?: string }
    >();

    if (userIds.length > 0) {
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nombre, matricula, carrera, semestre, grupo")
          .in("id", userIds);
        if (Array.isArray(profs)) {
          for (const p of profs as Array<Record<string, unknown>>) {
            profMap.set(String(p.id), {
              nombre: p.nombre ? String(p.nombre) : undefined,
              matricula: p.matricula ? String(p.matricula) : undefined,
              carrera: p.carrera ? String(p.carrera) : undefined,
              semestre: p.semestre ? String(p.semestre) : undefined,
              grupo: p.grupo ? String(p.grupo) : undefined,
            });
          }
        }
      } catch {
        // Continuar sin enriquecimiento
      }
    }

    const medCat = await getProfesionalCatalogo("medico");
    const medMap = new Map(medCat.map((m) => [m.id, m.nombre]));

    dbRecords = data.map((row: Record<string, unknown>) => {
      const uid = String(row.user_id || "");
      const stProf = profMap.get(uid);
      const nombreSt = stProf?.nombre || "Estudiante TESH";
      const iniciales =
        nombreSt
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => `${part[0]?.toUpperCase() || ""}.`)
          .join("") || "E.T.";
      return sanitizeForMedico({
        id: String(row.id),
        folio: String(row.folio || ""),
        user_id: uid,
        psicologo_id: row.psicologo_id ? String(row.psicologo_id) : null,
        nombre_psicologo:
          (row.psicologo_id ? medMap.get(String(row.psicologo_id)) : undefined) ||
          "Médico Universitario TESH",
        tipo_profesional: "medico",
        nombre_estudiante: nombreSt,
        iniciales_estudiante: iniciales,
        matricula: (row.matricula ? String(row.matricula) : undefined) || stProf?.matricula,
        carrera_estudiante: stProf?.carrera,
        semestre_estudiante: stProf?.semestre,
        grupo_estudiante: stProf?.grupo,
        email: row.email ? String(row.email) : undefined,
        fecha_solicitud: String(row.fecha_solicitud || row.created_at || new Date().toISOString()),
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
      });
    });
  }

  if (USE_LIVE_SUPABASE) {
    const filtered = filtros?.medicoId
      ? dbRecords.filter((c) => !c.psicologo_id || c.psicologo_id === filtros.medicoId)
      : dbRecords;
    return filtered.sort((a, b) => {
      const da = new Date(
        `${a.fecha_cita}T${normalizarHoraSlot(a.hora_cita) || "00:00"}`,
      ).getTime();
      const db = new Date(
        `${b.fecha_cita}T${normalizarHoraSlot(b.hora_cita) || "00:00"}`,
      ).getTime();
      return da - db;
    });
  }

  let localMed = getLocalSolicitudes()
    .filter((s) => s.tipo_profesional === "medico")
    .map(sanitizeForMedico);

  if (filtros?.fecha) {
    localMed = localMed.filter((s) => s.fecha_cita === filtros.fecha);
  }
  if (filtros?.estado) {
    localMed = localMed.filter((s) => s.estado === filtros.estado);
  }

  const dbIds = new Set(dbRecords.map((r) => r.id));
  const combined = [...dbRecords, ...localMed.filter((l) => !dbIds.has(l.id))];

  if (filtros?.medicoId) {
    const filtered = combined.filter((c) => !c.psicologo_id || c.psicologo_id === filtros.medicoId);
    if (filtered.length > 0) return filtered;
  }

  return combined.sort((a, b) => {
    const da = new Date(`${a.fecha_cita}T${normalizarHoraSlot(a.hora_cita) || "00:00"}`).getTime();
    const db = new Date(`${b.fecha_cita}T${normalizarHoraSlot(b.hora_cita) || "00:00"}`).getTime();
    return da - db;
  });
}

/**
 * Obtener las horas ya ocupadas para una fecha y especialidad dada (Psicólogo vs Médico).
 * Las agendas de psicólogo y médico son completamente independientes.
 */
export async function getCitasOcupadasPorFecha(
  fecha: string,
  profesionalId?: string,
  tipo: TipoProfesional = "psicologo",
): Promise<string[]> {
  const activeBookings = await getActiveBookingsByDate(fecha, tipo);
  const horasSet = new Set<string>();

  if (profesionalId) {
    for (const b of activeBookings) {
      if (!b.psicologo_id || b.psicologo_id === profesionalId) {
        horasSet.add(b.hora);
      }
    }
    return Array.from(horasSet);
  }

  const catalogo = await getProfesionalCatalogo(tipo);
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
 * del especialista según `tipo_profesional` ('psicologo' | 'medico') y constraint UNIQUE.
 */
export async function crearSolicitudCita(
  solicitud: Omit<SolicitudCita, "id" | "fecha_solicitud" | "created_at" | "updated_at">,
): Promise<{ ok: boolean; cita?: SolicitudCita; error?: string }> {
  const tipoProfesional: TipoProfesional =
    solicitud.tipo_profesional === "medico" ? "medico" : "psicologo";

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

  // 4. Validar límite de 1 cita activa por especialidad para permitir seguimiento médico + psicológico si Eli lo sugiere
  const existentes = await getSolicitudesEstudiante(solicitud.user_id, solicitud.folio);
  const activa = existentes.find(
    (c) =>
      (c.tipo_profesional || "psicologo") === tipoProfesional &&
      (c.estado === "pendiente" || c.estado === "confirmada"),
  );
  if (activa) {
    const areaNombre = tipoProfesional === "medico" ? "Médico universitario" : "Psicólogo clínico";
    return {
      ok: false,
      error: `Ya cuentas con una cita activa con ${areaNombre} el ${activa.fecha_cita} a las ${activa.hora_cita} hrs. Solo se permite una cita activa por área.`,
    };
  }

  // 5. Asignación automática del especialista disponible según tipo_profesional
  const profesionalAsignado = await getProfesionalDisponible(
    solicitud.fecha_cita,
    horaNormalizada,
    tipoProfesional,
  );
  if (!profesionalAsignado) {
    return {
      ok: false,
      error: `El horario de las ${horaNormalizada} hrs para el ${solicitud.fecha_cita} ya fue reservado. Selecciona otro horario disponible.`,
    };
  }

  // 6. Doble verificación UNIQUE (psicologo_id + fecha_cita + hora_cita) aislada por tipo_profesional
  const activeBookings = await getActiveBookingsByDate(solicitud.fecha_cita, tipoProfesional);
  const conflict = activeBookings.some(
    (b) =>
      b.hora === horaNormalizada &&
      (b.psicologo_id === profesionalAsignado.id || b.psicologo_id === null),
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
    tipo_profesional: tipoProfesional,
    psicologo_id: profesionalAsignado.id,
    nombre_psicologo: profesionalAsignado.nombre,
    hora_cita: horaNormalizada,
    id: `sol-${Date.now().toString(36)}`,
    fecha_solicitud: new Date().toISOString(),
    modalidad: "presencial",
    estado: "pendiente",
    motivo: motivoLimpio || null,
  };

  if (tipoProfesional === "medico") {
    delete nuevaCita.nivel_tamizaje;
    delete nuevaCita.puntaje_phq9;
    delete nuevaCita.puntaje_gad7;
    delete nuevaCita.folio_tamizaje;
  }

  const authUid = await getAuthenticatedUid();
  if (USE_LIVE_SUPABASE && !authUid && !UUID_REGEX.test(solicitud.user_id)) {
    return {
      ok: false,
      error: "Debes iniciar sesión con tu cuenta institucional para agendar una cita.",
    };
  }

  if (authUid || UUID_REGEX.test(solicitud.user_id)) {
    try {
      const dbUserId = authUid || solicitud.user_id;
      const dbProfId = UUID_REGEX.test(profesionalAsignado.id) ? profesionalAsignado.id : null;
      const insertPayload: Record<string, unknown> = {
        folio: nuevaCita.folio,
        user_id: dbUserId,
        psicologo_id: dbProfId,
        tipo_profesional: tipoProfesional,
        fecha_cita: nuevaCita.fecha_cita,
        hora_cita: nuevaCita.hora_cita,
        modalidad: "presencial",
        estado: "pendiente",
        motivo: nuevaCita.motivo,
      };
      if (solicitud.matricula) insertPayload.matricula = solicitud.matricula;
      if (solicitud.email) insertPayload.email = solicitud.email;

      let { data, error } = await supabase
        .from("solicitudes_cita")
        .insert(insertPayload)
        .select()
        .single();

      if (error && error.message.toLowerCase().includes("tipo_profesional")) {
        delete insertPayload.tipo_profesional;
        const retry = await supabase
          .from("solicitudes_cita")
          .insert(insertPayload)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

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
    } catch (err) {
      if (USE_LIVE_SUPABASE) {
        return {
          ok: false,
          error:
            err instanceof Error ? err.message : "No se pudo registrar la cita en el servidor.",
        };
      }
    }
  }

  if (!USE_LIVE_SUPABASE) {
    const localList = getLocalSolicitudes();
    saveLocalSolicitudes([nuevaCita, ...localList]);
  }

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

  if (USE_LIVE_SUPABASE && !UUID_REGEX.test(citaId)) {
    return { ok: false, error: "Identificador de cita inválido." };
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
    } catch (err) {
      if (USE_LIVE_SUPABASE) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "No se pudo cancelar la cita.",
        };
      }
    }
  }

  if (!USE_LIVE_SUPABASE) {
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

  if (USE_LIVE_SUPABASE && !UUID_REGEX.test(citaId)) {
    return { ok: false, triggerEncuestaAbandono: false };
  }

  const localList = USE_LIVE_SUPABASE ? [] : getLocalSolicitudes();
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

    const { data, error } = await supabase
      .from("solicitudes_cita")
      .update(updatePayload)
      .eq("id", citaId)
      .select()
      .maybeSingle();

    if (USE_LIVE_SUPABASE && error) {
      return { ok: false, triggerEncuestaAbandono: false };
    }

    if (data && !targetCita) {
      targetCita = data as SolicitudCita;
    }

    if (
      targetCita?.user_id &&
      UUID_REGEX.test(targetCita.user_id) &&
      !targetCita.carrera_estudiante
    ) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nombre, carrera")
        .eq("id", targetCita.user_id)
        .maybeSingle();
      if (prof) {
        targetCita = {
          ...targetCita,
          nombre_estudiante:
            targetCita.nombre_estudiante || (prof.nombre ? String(prof.nombre) : undefined),
          carrera_estudiante: prof.carrera ? String(prof.carrera) : undefined,
        };
      }
    }
  } catch {
    if (USE_LIVE_SUPABASE) {
      return { ok: false, triggerEncuestaAbandono: false };
    }
  }

  if (!USE_LIVE_SUPABASE) {
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
      USE_LIVE_SUPABASE
        ? []
        : localList.filter(
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
      // Continuar
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

/**
 * Actualizar estado de cita por el Médico Universitario (sin disparar encuestas ni alertas psicológicas).
 */
export async function actualizarEstadoCitaMedico(
  citaId: string,
  nuevoEstado: EstadoCita,
  motivoCancelacion?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (USE_LIVE_SUPABASE && !UUID_REGEX.test(citaId)) {
    return { ok: false, error: "Identificador de cita inválido." };
  }

  if (UUID_REGEX.test(citaId)) {
    try {
      const updatePayload: Record<string, unknown> = {
        estado: nuevoEstado,
        updated_at: new Date().toISOString(),
      };
      if (nuevoEstado === "cancelada") {
        updatePayload.cancelado_por = "medico";
        updatePayload.motivo_cancelacion =
          motivoCancelacion?.trim() || "Cancelada por el Servicio Médico Universitario";
      }

      const { error } = await supabase
        .from("solicitudes_cita")
        .update(updatePayload)
        .eq("id", citaId);

      if (error) {
        return { ok: false, error: error.message };
      }
    } catch (err) {
      if (USE_LIVE_SUPABASE) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "No se pudo actualizar la cita médica.",
        };
      }
    }
  }

  if (!USE_LIVE_SUPABASE) {
    const localList = getLocalSolicitudes();
    const index = localList.findIndex((c) => c.id === citaId);
    if (index !== -1) {
      const target = localList[index];
      localList[index] = {
        ...target,
        estado: nuevoEstado,
        cancelado_por: nuevoEstado === "cancelada" ? "medico" : target.cancelado_por,
        motivo_cancelacion:
          nuevoEstado === "cancelada"
            ? motivoCancelacion?.trim() || "Cancelada por el Servicio Médico Universitario"
            : target.motivo_cancelacion,
        updated_at: new Date().toISOString(),
      };
      saveLocalSolicitudes(localList);
    }
  }

  return { ok: true };
}
