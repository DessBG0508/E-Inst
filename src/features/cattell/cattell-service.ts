import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { calcularPerfilCattell } from "./cattell-16pf-data";
import type {
  CattellConteoStats,
  CattellOption,
  ConvocatoriaDual,
  DictamenCattell,
  EstudianteDualOption,
  EvaluacionCattellRecord,
  RespuestaCattellInput,
} from "./cattell-types";

export const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;

function mapSchemaMissingError(err: { code?: string; message?: string } | null): string | null {
  if (!err) return null;
  const msg = err.message ?? "";
  if (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    msg.includes("convocatorias_dual") ||
    msg.includes("evaluaciones_cattell") ||
    msg.includes("Could not find the table")
  ) {
    return "Falta ejecutar la migración SQL de Educación Dual (supabase/schema_cattell_dual.sql) en el SQL Editor de Supabase.";
  }
  return msg || "Error al comunicarse con Supabase.";
}

export async function fetchConvocatoriasDual(): Promise<{
  data: ConvocatoriaDual[];
  error: string | null;
}> {
  if (!USE_LIVE_SUPABASE) {
    return { data: [], error: "Supabase en vivo no está configurado." };
  }

  const { data, error } = await supabase
    .from("convocatorias_dual")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: [], error: mapSchemaMissingError(error) };
  }

  return { data: (data ?? []) as ConvocatoriaDual[], error: null };
}

export async function createConvocatoriaDual(input: {
  nombre: string;
  periodo: string;
  descripcion?: string;
  fecha_limite?: string | null;
  creado_por: string;
}): Promise<{ data: ConvocatoriaDual | null; error: string | null }> {
  const { data, error } = await supabase
    .from("convocatorias_dual")
    .insert({
      nombre: input.nombre.trim(),
      periodo: input.periodo.trim(),
      descripcion: input.descripcion?.trim() || null,
      fecha_limite: input.fecha_limite || null,
      activa: true,
      creado_por: input.creado_por,
    })
    .select("*")
    .single();

  if (error) {
    return { data: null, error: mapSchemaMissingError(error) };
  }

  return { data: data as ConvocatoriaDual, error: null };
}

export async function toggleConvocatoriaActiva(
  id: string,
  activa: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from("convocatorias_dual").update({ activa }).eq("id", id);

  if (error) {
    return { ok: false, error: mapSchemaMissingError(error) };
  }
  return { ok: true, error: null };
}

export async function fetchEstudiantesParaDual(): Promise<{
  data: EstudianteDualOption[];
  error: string | null;
}> {
  // Intentar primero con la función RPC dedicada (SECURITY DEFINER solo psicólogo)
  const { data: rpcData, error: rpcError } = await supabase.rpc("listar_estudiantes_dual");

  if (!rpcError && Array.isArray(rpcData)) {
    return { data: rpcData as EstudianteDualOption[], error: null };
  }

  // Fallback directo sobre profiles (RLS de psicólogo permite ver perfiles)
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, name, email, matricula, carrera, semestre, grupo, rol")
    .eq("rol", "estudiante")
    .order("carrera", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    return { data: [], error: mapSchemaMissingError(error) };
  }

  const mapped: EstudianteDualOption[] = (data ?? []).map((p) => ({
    id: p.id,
    nombre: (p.nombre || p.name || p.email || "Estudiante").trim(),
    email: p.email,
    matricula: p.matricula ?? null,
    carrera: p.carrera ?? null,
    semestre: p.semestre ?? null,
    grupo: p.grupo ?? null,
  }));

  return { data: mapped, error: null };
}

export async function fetchEvaluacionesByConvocatoria(convocatoriaId: string): Promise<{
  data: EvaluacionCattellRecord[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("evaluaciones_cattell")
    .select(
      `
      *,
      estudiante:profiles!evaluaciones_cattell_estudiante_id_fkey(
        id, nombre, name, email, matricula, carrera, semestre, grupo
      )
    `,
    )
    .eq("convocatoria_id", convocatoriaId)
    .order("fecha_envio", { ascending: false });

  if (error) {
    return { data: [], error: mapSchemaMissingError(error) };
  }

  const records: EvaluacionCattellRecord[] = (data ?? []).map((row) => {
    const est = Array.isArray(row.estudiante) ? row.estudiante[0] : row.estudiante;
    return {
      id: row.id,
      convocatoria_id: row.convocatoria_id,
      estudiante_id: row.estudiante_id,
      estudiante_nombre: est?.nombre || est?.name || est?.email?.split("@")[0] || "Estudiante TESH",
      estudiante_email: est?.email || "",
      estudiante_matricula: est?.matricula ?? null,
      estudiante_carrera: est?.carrera ?? null,
      estudiante_semestre: est?.semestre ?? null,
      estudiante_grupo: est?.grupo ?? null,
      token_acceso: row.token_acceso,
      estado: row.estado,
      total_reactivos: row.total_reactivos ?? 64,
      reactivos_respondidos: row.reactivos_respondidos ?? 0,
      puntajes_brutos: row.puntajes_brutos ?? {},
      puntajes_decatipos: row.puntajes_decatipos ?? {},
      factores_globales: row.factores_globales ?? {},
      pre_recomendacion: row.pre_recomendacion ?? null,
      dictamen: row.dictamen ?? "pendiente",
      observaciones_psicologo: row.observaciones_psicologo ?? null,
      fecha_envio: row.fecha_envio,
      fecha_inicio: row.fecha_inicio ?? null,
      fecha_completado: row.fecha_completado ?? null,
      fecha_dictamen: row.fecha_dictamen ?? null,
    };
  });

  return { data: records, error: null };
}

export async function habilitarEstudiantesCattell(
  convocatoriaId: string,
  estudianteIds: string[],
  psicologoId: string,
): Promise<{ insertedCount: number; error: string | null }> {
  if (estudianteIds.length === 0) {
    return { insertedCount: 0, error: null };
  }

  const rows = estudianteIds.map((estudiante_id) => ({
    convocatoria_id: convocatoriaId,
    estudiante_id,
    habilitado_por: psicologoId,
    total_reactivos: 64,
    estado: "pendiente",
    dictamen: "pendiente",
  }));

  const { data, error } = await supabase
    .from("evaluaciones_cattell")
    .upsert(rows, {
      onConflict: "convocatoria_id,estudiante_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    return { insertedCount: 0, error: mapSchemaMissingError(error) };
  }

  return { insertedCount: (data ?? []).length, error: null };
}

export async function removerAspirantePendiente(
  evaluacionId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase
    .from("evaluaciones_cattell")
    .delete()
    .eq("id", evaluacionId)
    .eq("estado", "pendiente");

  if (error) {
    return { ok: false, error: mapSchemaMissingError(error) };
  }
  return { ok: true, error: null };
}

export async function guardarDictamenCattell(
  evaluacionId: string,
  dictamen: DictamenCattell,
  observaciones: string,
  psicologoId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase
    .from("evaluaciones_cattell")
    .update({
      dictamen,
      observaciones_psicologo: observaciones.trim() || null,
      evaluado_por: psicologoId,
      fecha_dictamen: new Date().toISOString(),
    })
    .eq("id", evaluacionId);

  if (error) {
    return { ok: false, error: mapSchemaMissingError(error) };
  }
  return { ok: true, error: null };
}

/**
 * Consulta la evaluación Cattell asignada exclusivamente al estudiante autenticado.
 * Si no fue seleccionado para Educación Dual, devuelve null.
 */
export async function fetchMiEvaluacionCattell(
  userId: string,
  token?: string | null,
): Promise<{ data: EvaluacionCattellRecord | null; error: string | null }> {
  let query = supabase
    .from("evaluaciones_cattell")
    .select(
      `
      *,
      convocatoria:convocatorias_dual(id, nombre, periodo, fecha_limite, activa)
    `,
    )
    .eq("estudiante_id", userId);

  if (token) {
    query = query.eq("token_acceso", token);
  } else {
    query = query.in("estado", ["pendiente", "en_progreso"]);
  }

  const { data, error } = await query.order("fecha_envio", { ascending: false }).limit(1);

  if (error) {
    // Si las tablas Dual aún no se ejecutan en Supabase, no romper el Home del estudiante
    return { data: null, error: mapSchemaMissingError(error) };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { data: null, error: null };
  }

  const conv = Array.isArray(row.convocatoria) ? row.convocatoria[0] : row.convocatoria;
  // Si no viene con token específico y la convocatoria fue desactivada, no mostrar banner
  if (!token && conv && conv.activa === false) {
    return { data: null, error: null };
  }

  const record: EvaluacionCattellRecord = {
    id: row.id,
    convocatoria_id: row.convocatoria_id,
    convocatoria_nombre: conv?.nombre ?? "Programa Educación Dual",
    convocatoria_periodo: conv?.periodo ?? "",
    convocatoria_fecha_limite: conv?.fecha_limite ?? null,
    estudiante_id: row.estudiante_id,
    estudiante_nombre: "",
    estudiante_email: "",
    estudiante_matricula: null,
    estudiante_carrera: null,
    estudiante_semestre: null,
    estudiante_grupo: null,
    token_acceso: row.token_acceso,
    estado: row.estado,
    total_reactivos: row.total_reactivos ?? 64,
    reactivos_respondidos: row.reactivos_respondidos ?? 0,
    puntajes_brutos: row.puntajes_brutos ?? {},
    puntajes_decatipos: row.puntajes_decatipos ?? {},
    factores_globales: row.factores_globales ?? {},
    pre_recomendacion: row.pre_recomendacion ?? null,
    dictamen: row.dictamen ?? "pendiente",
    observaciones_psicologo: row.observaciones_psicologo ?? null,
    fecha_envio: row.fecha_envio,
    fecha_inicio: row.fecha_inicio ?? null,
    fecha_completado: row.fecha_completado ?? null,
    fecha_dictamen: row.fecha_dictamen ?? null,
  };

  return { data: record, error: null };
}

export async function fetchMisRespuestasCattell(evaluacionId: string): Promise<{
  respuestas: Record<number, CattellOption>;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("respuestas_cattell")
    .select("numero_pregunta, opcion")
    .eq("evaluacion_id", evaluacionId);

  if (error) {
    return { respuestas: {}, error: mapSchemaMissingError(error) };
  }

  const map: Record<number, CattellOption> = {};
  for (const row of data ?? []) {
    if (row.opcion === "A" || row.opcion === "B" || row.opcion === "C") {
      map[row.numero_pregunta] = row.opcion;
    }
  }
  return { respuestas: map, error: null };
}

export async function guardarProgresoCattell(
  evaluacionId: string,
  respuestasBatch: RespuestaCattellInput[],
  totalRespondidas: number,
  iniciarSiPendiente: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  if (respuestasBatch.length > 0) {
    const { error: upsertErr } = await supabase.from("respuestas_cattell").upsert(
      respuestasBatch.map((r) => ({
        evaluacion_id: evaluacionId,
        numero_pregunta: r.numero_pregunta,
        factor_codigo: r.factor_codigo,
        opcion: r.opcion,
        puntos: r.puntos,
      })),
      { onConflict: "evaluacion_id,numero_pregunta" },
    );

    if (upsertErr) {
      return { ok: false, error: mapSchemaMissingError(upsertErr) };
    }
  }

  const updatePayload: Record<string, unknown> = {
    estado: "en_progreso",
    reactivos_respondidos: totalRespondidas,
  };
  if (iniciarSiPendiente) {
    updatePayload.fecha_inicio = new Date().toISOString();
  }

  const { error: evalErr } = await supabase
    .from("evaluaciones_cattell")
    .update(updatePayload)
    .eq("id", evaluacionId)
    .neq("estado", "completado");

  if (evalErr) {
    return { ok: false, error: mapSchemaMissingError(evalErr) };
  }

  return { ok: true, error: null };
}

export async function enviarEvaluacionCattell(
  evaluacionId: string,
  respuestasBatch: RespuestaCattellInput[],
  respuestasMap: Record<number, CattellOption>,
): Promise<{ ok: boolean; error: string | null }> {
  const { error: upsertErr } = await supabase.from("respuestas_cattell").upsert(
    respuestasBatch.map((r) => ({
      evaluacion_id: evaluacionId,
      numero_pregunta: r.numero_pregunta,
      factor_codigo: r.factor_codigo,
      opcion: r.opcion,
      puntos: r.puntos,
    })),
    { onConflict: "evaluacion_id,numero_pregunta" },
  );

  if (upsertErr) {
    return { ok: false, error: mapSchemaMissingError(upsertErr) };
  }

  const perfil = calcularPerfilCattell(respuestasMap);
  const now = new Date().toISOString();

  const { error: evalErr } = await supabase
    .from("evaluaciones_cattell")
    .update({
      estado: "completado",
      reactivos_respondidos: respuestasBatch.length,
      puntajes_brutos: perfil.puntajesBrutos,
      puntajes_decatipos: perfil.puntajesDecatipos,
      factores_globales: perfil.factoresGlobales,
      pre_recomendacion: perfil.preRecomendacion,
      fecha_completado: now,
    })
    .eq("id", evaluacionId)
    .neq("estado", "completado");

  if (evalErr) {
    return { ok: false, error: mapSchemaMissingError(evalErr) };
  }

  return { ok: true, error: null };
}

export function computeCattellStats(evaluaciones: EvaluacionCattellRecord[]): CattellConteoStats {
  return {
    totalHabilitados: evaluaciones.length,
    pendientes: evaluaciones.filter((e) => e.estado === "pendiente").length,
    enProgreso: evaluaciones.filter((e) => e.estado === "en_progreso").length,
    completados: evaluaciones.filter((e) => e.estado === "completado").length,
    dictamenPendiente: evaluaciones.filter(
      (e) => e.estado === "completado" && e.dictamen === "pendiente",
    ).length,
    aptos: evaluaciones.filter((e) => e.dictamen === "apto").length,
    aptoConObservaciones: evaluaciones.filter((e) => e.dictamen === "apto_con_observaciones")
      .length,
    noAptos: evaluaciones.filter((e) => e.dictamen === "no_apto").length,
  };
}
