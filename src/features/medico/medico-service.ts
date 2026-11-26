import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { DEMO_MODE } from "@/lib/mock-data";
import { getAuthenticatedUid } from "@/features/tutor/tutor-service";

export interface ExpedienteMedicoRecord {
  id: string;
  estudiante_id: string;
  estudiante_nombre: string;
  matricula: string;
  carrera: string;
  grupo: string;
  medico_id: string;
  medico_nombre: string;
  fecha_consulta: string; // YYYY-MM-DD
  motivo_consulta: string;
  presion_arterial?: string;
  frecuencia_cardiaca?: string;
  temperatura?: string;
  diagnostico_fisico: string;
  indicaciones: string;
  canalizado_psicologia: boolean;
  created_at: string;
  updated_at?: string;
}

const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;
const STORAGE_KEY = "equilibra_expedientes_medicos_v1";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SEED_EXPEDIENTES_MEDICOS: ExpedienteMedicoRecord[] = [
  {
    id: "exp-med-demo-001",
    estudiante_id: "demo-student-isc-601-1",
    estudiante_nombre: "Fernanda López",
    matricula: "202210301",
    carrera: "Ing. en Sistemas Computacionales",
    grupo: "601",
    medico_id: "demo-medico-alejandro",
    medico_nombre: "Dr. Alejandro Vega",
    fecha_consulta: "2026-11-20",
    motivo_consulta: "Cefalea tensional matutina, insomnio y agotamiento físico.",
    presion_arterial: "115/75 mmHg",
    frecuencia_cardiaca: "78 lpm",
    temperatura: "36.5 °C",
    diagnostico_fisico:
      "Sin alteraciones neurológicas ni hallazgos orgánicos agudos. Tensión cervical leve por desvelo.",
    indicaciones:
      "Hidratación adecuada, pausas visuales cada 45 min e higiene de sueño. Se canaliza a Psicología para manejo de sobrecarga emocional.",
    canalizado_psicologia: true,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "exp-med-demo-002",
    estudiante_id: "demo-student-isc-2",
    estudiante_nombre: "Valeria Morales",
    matricula: "202310489",
    carrera: "Ing. en Sistemas Computacionales",
    grupo: "501",
    medico_id: "demo-medico-alejandro",
    medico_nombre: "Dr. Alejandro Vega",
    fecha_consulta: "2026-11-18",
    motivo_consulta: "Cefaleas recurrentes e insomnio previo a entrega de proyectos.",
    presion_arterial: "110/70 mmHg",
    frecuencia_cardiaca: "74 lpm",
    temperatura: "36.4 °C",
    diagnostico_fisico: "Signos vitales dentro de parámetros normales. Cefalea tensional benigna.",
    indicaciones:
      "Regulación de horarios de descanso, reducción de cafeína vespertina y control en 7 días.",
    canalizado_psicologia: false,
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

function readLocalExpedientes(): ExpedienteMedicoRecord[] {
  if (typeof window === "undefined") return SEED_EXPEDIENTES_MEDICOS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_EXPEDIENTES_MEDICOS));
      return SEED_EXPEDIENTES_MEDICOS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ExpedienteMedicoRecord[]) : SEED_EXPEDIENTES_MEDICOS;
  } catch {
    return SEED_EXPEDIENTES_MEDICOS;
  }
}

function writeLocalExpedientes(list: ExpedienteMedicoRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Consulta expedientes médicos simplificados (LFPDPPP: tabla separada de `expedientes_clinicos`).
 */
export async function getExpedientesMedicos(medicoId?: string): Promise<ExpedienteMedicoRecord[]> {
  const local = USE_LIVE_SUPABASE ? [] : readLocalExpedientes();
  const authUid = await getAuthenticatedUid();
  const effectiveMedicoId = authUid || medicoId;

  if (effectiveMedicoId && UUID_REGEX.test(effectiveMedicoId)) {
    const { data, error } = await supabase
      .from("expedientes_medicos")
      .select("*")
      .eq("medico_id", effectiveMedicoId)
      .order("fecha_consulta", { ascending: false })
      .order("created_at", { ascending: false });

    if (USE_LIVE_SUPABASE && error) {
      throw new Error(error.message);
    }

    if (!error && Array.isArray(data)) {
      const studentIds = Array.from(
        new Set(
          data
            .map((r: Record<string, unknown>) => (r.estudiante_id ? String(r.estudiante_id) : ""))
            .filter((id) => UUID_REGEX.test(id)),
        ),
      );
      const profMap = new Map<
        string,
        { nombre?: string; matricula?: string; carrera?: string; grupo?: string }
      >();

      if (studentIds.length > 0) {
        try {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, nombre, matricula, carrera, grupo")
            .in("id", studentIds);
          if (Array.isArray(profs)) {
            for (const p of profs as Array<Record<string, unknown>>) {
              profMap.set(String(p.id), {
                nombre: p.nombre ? String(p.nombre) : undefined,
                matricula: p.matricula ? String(p.matricula) : undefined,
                carrera: p.carrera ? String(p.carrera) : undefined,
                grupo: p.grupo ? String(p.grupo) : undefined,
              });
            }
          }
        } catch {
          // Continuar sin enriquecimiento
        }
      }

      const dbRecords: ExpedienteMedicoRecord[] = data.map((row: Record<string, unknown>) => {
        const stuId = String(row.estudiante_id || "");
        const stProf = profMap.get(stuId);
        return {
          id: String(row.id),
          estudiante_id: stuId,
          estudiante_nombre:
            (row.estudiante_nombre ? String(row.estudiante_nombre) : undefined) ||
            stProf?.nombre ||
            "Estudiante TESH",
          matricula:
            (row.matricula ? String(row.matricula) : undefined) ||
            stProf?.matricula ||
            "Sin matrícula",
          carrera:
            (row.carrera ? String(row.carrera) : undefined) || stProf?.carrera || "Carrera TESH",
          grupo: (row.grupo ? String(row.grupo) : undefined) || stProf?.grupo || "Sin grupo",
          medico_id: String(row.medico_id || effectiveMedicoId),
          medico_nombre: row.medico_nombre
            ? String(row.medico_nombre)
            : "Médico Universitario TESH",
          fecha_consulta: String(row.fecha_consulta || new Date().toISOString().slice(0, 10)),
          motivo_consulta: String(row.motivo_consulta || ""),
          presion_arterial: row.presion_arterial ? String(row.presion_arterial) : undefined,
          frecuencia_cardiaca: row.frecuencia_cardiaca
            ? String(row.frecuencia_cardiaca)
            : undefined,
          temperatura: row.temperatura ? String(row.temperatura) : undefined,
          diagnostico_fisico: String(row.diagnostico_fisico || ""),
          indicaciones: String(row.indicaciones || ""),
          canalizado_psicologia: Boolean(row.canalizado_psicologia),
          created_at: String(row.created_at || new Date().toISOString()),
          updated_at: row.updated_at ? String(row.updated_at) : undefined,
        };
      });

      if (USE_LIVE_SUPABASE) {
        return dbRecords;
      }

      const seen = new Set(dbRecords.map((r) => r.id));
      return [...dbRecords, ...local.filter((l) => !seen.has(l.id))];
    }
  }

  if (USE_LIVE_SUPABASE) {
    return [];
  }

  return [...local].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Registra una nota médica simplificada en `expedientes_medicos` (y localStorage en modo demo).
 */
export async function saveExpedienteMedico(input: {
  estudiante_id: string;
  estudiante_nombre: string;
  matricula: string;
  carrera: string;
  grupo: string;
  medico_id: string;
  medico_nombre: string;
  fecha_consulta: string;
  motivo_consulta: string;
  presion_arterial?: string;
  frecuencia_cardiaca?: string;
  temperatura?: string;
  diagnostico_fisico: string;
  indicaciones: string;
  canalizado_psicologia: boolean;
}): Promise<{ ok: boolean; record?: ExpedienteMedicoRecord; error?: string }> {
  const motivoClean = input.motivo_consulta.trim();
  const diagClean = input.diagnostico_fisico.trim();
  const indClean = input.indicaciones.trim();

  if (!input.estudiante_id || !motivoClean || !diagClean) {
    return {
      ok: false,
      error: "Selecciona un estudiante e indica motivo de consulta y valoración física.",
    };
  }

  const authUid = await getAuthenticatedUid();
  const effectiveMedicoId = authUid || input.medico_id;

  const newRecord: ExpedienteMedicoRecord = {
    id: `exp-med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    estudiante_id: input.estudiante_id,
    estudiante_nombre: input.estudiante_nombre,
    matricula: input.matricula,
    carrera: input.carrera,
    grupo: input.grupo,
    medico_id: effectiveMedicoId,
    medico_nombre: input.medico_nombre,
    fecha_consulta: input.fecha_consulta || new Date().toISOString().slice(0, 10),
    motivo_consulta: motivoClean,
    presion_arterial: input.presion_arterial?.trim() || undefined,
    frecuencia_cardiaca: input.frecuencia_cardiaca?.trim() || undefined,
    temperatura: input.temperatura?.trim() || undefined,
    diagnostico_fisico: diagClean,
    indicaciones: indClean || "Seguimiento ambulatorio según evolución.",
    canalizado_psicologia: input.canalizado_psicologia,
    created_at: new Date().toISOString(),
  };

  if (
    USE_LIVE_SUPABASE &&
    (!UUID_REGEX.test(effectiveMedicoId) || !UUID_REGEX.test(input.estudiante_id))
  ) {
    return {
      ok: false,
      error: "Inicia sesión como médico institucional y selecciona un estudiante válido.",
    };
  }

  if (UUID_REGEX.test(effectiveMedicoId) && UUID_REGEX.test(input.estudiante_id)) {
    try {
      const { data, error } = await supabase
        .from("expedientes_medicos")
        .insert({
          estudiante_id: input.estudiante_id,
          medico_id: effectiveMedicoId,
          fecha_consulta: newRecord.fecha_consulta,
          motivo_consulta: newRecord.motivo_consulta,
          presion_arterial: newRecord.presion_arterial || null,
          frecuencia_cardiaca: newRecord.frecuencia_cardiaca || null,
          temperatura: newRecord.temperatura || null,
          diagnostico_fisico: newRecord.diagnostico_fisico,
          indicaciones: newRecord.indicaciones,
          canalizado_psicologia: newRecord.canalizado_psicologia,
        })
        .select()
        .single();

      if (error) {
        return { ok: false, error: error.message };
      }

      if (data) {
        newRecord.id = String(data.id);
        if (data.created_at) newRecord.created_at = String(data.created_at);
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "No se pudo guardar el expediente médico.",
      };
    }
  }

  if (!USE_LIVE_SUPABASE) {
    const local = readLocalExpedientes();
    writeLocalExpedientes([newRecord, ...local]);
  }

  return { ok: true, record: newRecord };
}
