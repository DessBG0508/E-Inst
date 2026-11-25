import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AnuncioFormInput, AnuncioInscripcion, AnuncioItem } from "./types";

const ANUNCIOS_STORAGE_KEY = "equilibra_anuncios_v1";
const INSCRIPCIONES_STORAGE_KEY = "equilibra_anuncios_inscripciones_v1";

const DEFAULT_ANUNCIOS: AnuncioItem[] = [
  {
    id: "anuncio-taller-manejo-estres-2026",
    titulo: "Manejo del estrés antes de exámenes finales",
    descripcion:
      "Estrategias prácticas de regulación emocional, respiración 4-7-8 y organización académica para el cierre de semestre.",
    descripcion_larga:
      "Módulo 1: Identificación temprana de señales de sobrecarga cognitiva.\nMódulo 2: Técnicas breves de respiración y anclaje sensorial entre clases.\nMódulo 3: Planificación realista de entregas y manejo del perfeccionismo.\nMódulo 4: Rutas de acompañamiento psicológico disponibles en el TESH.",
    tipo: "taller",
    fecha_evento: "2026-11-27",
    hora_inicio: "11:00",
    hora_fin: "12:30",
    lugar: "Auditorio Edificio B — Campus TESH",
    ponente: "Mtra. Sofía Ramírez — Psicología Clínica TESH",
    requisitos: "Traer credencial vigente TESH y libreta o dispositivo para notas.",
    cupo: 30,
    inscritos: 18,
    publico_objetivo: "todos",
    imagen_url: null,
    activo: true,
    created_at: "2026-11-10T14:00:00Z",
    updated_at: "2026-11-10T14:00:00Z",
  },
  {
    id: "anuncio-evento-jornada-bienestar-2026",
    titulo: "Jornada Universitaria de Salud Emocional TESH",
    descripcion:
      "Conferencia inaugural, módulos de orientación psicológica y activación física para toda la comunidad estudiantil.",
    descripcion_larga:
      "09:00 hrs — Conferencia de apertura: Cuidado de la salud mental en carreras de ingeniería y gestión.\n10:30 hrs — Módulos informativos de prevención, tamizaje y redes de apoyo.\n12:00 hrs — Circuito de pausa activa y cierre institucional.",
    tipo: "evento",
    fecha_evento: "2026-12-03",
    hora_inicio: "09:00",
    hora_fin: "13:00",
    lugar: "Explanada Principal TESH Huixquilucan",
    ponente: "Departamento de Psicopedagogía y Bienestar TESH",
    requisitos: "Registro previo en plataforma. Asistencia abierta a todas las carreras.",
    cupo: 120,
    inscritos: 112,
    publico_objetivo: "todos",
    imagen_url: null,
    activo: true,
    created_at: "2026-11-12T10:00:00Z",
    updated_at: "2026-11-12T10:00:00Z",
  },
  {
    id: "anuncio-informativo-horarios-2026",
    titulo: "Horarios de atención psicológica presencial",
    descripcion:
      "Consulta los turnos matutino y vespertino disponibles para sesiones presenciales individuales en el edificio de tutorías.",
    descripcion_larga:
      "El servicio de acompañamiento psicológico presencial opera de lunes a viernes en dos turnos:\n• Turno matutino: 09:00 a 12:30 hrs.\n• Turno vespertino: 15:00 a 17:30 hrs.\nTodas las citas se agendan desde el módulo Mis Citas con al menos 2 horas de anticipación.",
    tipo: "informativo",
    fecha_evento: "2026-12-01",
    hora_inicio: "09:00",
    hora_fin: "17:30",
    lugar: "Cubículo de Psicología — Edificio A, Planta Baja",
    ponente: "Coordinación de Bienestar Estudiantil TESH",
    requisitos: "Contar con correo institucional activo y cita confirmada.",
    cupo: null,
    inscritos: 0,
    publico_objetivo: "todos",
    imagen_url: null,
    activo: true,
    created_at: "2026-11-14T09:00:00Z",
    updated_at: "2026-11-14T09:00:00Z",
  },
  {
    id: "anuncio-recordatorio-piloto-2026",
    titulo: "Cierre de tamizaje preventivo — Piloto Diciembre",
    descripcion:
      "Completa tu tamizaje breve con Eli y mantén actualizado tu seguimiento antes del periodo de evaluaciones.",
    descripcion_larga:
      "Tu participación en el seguimiento preventivo nos permite canalizar oportunamente a quienes requieren atención presencial.\nEl tamizaje toma menos de 5 minutos y está resguardado bajo la LFPDPPP.",
    tipo: "recordatorio",
    fecha_evento: "2026-12-08",
    hora_inicio: "08:00",
    hora_fin: "20:00",
    lugar: "Plataforma Equilibra TESH (en línea)",
    ponente: "Equipo Equilibra TESH",
    requisitos: "Iniciar sesión con cuenta institucional y responder con sinceridad.",
    cupo: 50,
    inscritos: 37,
    publico_objetivo: "sin_tamizaje",
    imagen_url: null,
    activo: true,
    created_at: "2026-11-15T12:00:00Z",
    updated_at: "2026-11-15T12:00:00Z",
  },
];

function getLocalAnuncios(): AnuncioItem[] {
  if (typeof window === "undefined") return DEFAULT_ANUNCIOS;
  try {
    const raw = localStorage.getItem(ANUNCIOS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ANUNCIOS_STORAGE_KEY, JSON.stringify(DEFAULT_ANUNCIOS));
      return DEFAULT_ANUNCIOS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as AnuncioItem[];
    }
    return DEFAULT_ANUNCIOS;
  } catch {
    return DEFAULT_ANUNCIOS;
  }
}

function saveLocalAnuncios(items: AnuncioItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANUNCIOS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignorar error de cuota
  }
}

function getLocalInscripciones(): AnuncioInscripcion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INSCRIPCIONES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AnuncioInscripcion[]) : [];
  } catch {
    return [];
  }
}

function saveLocalInscripciones(items: AnuncioInscripcion[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INSCRIPCIONES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignorar
  }
}

function mapRowToAnuncio(row: Record<string, unknown>): AnuncioItem {
  return {
    id: String(row.id),
    titulo: String(row.titulo || ""),
    descripcion: String(row.descripcion || ""),
    descripcion_larga: row.descripcion_larga ? String(row.descripcion_larga) : null,
    tipo: (row.tipo as AnuncioItem["tipo"]) || "taller",
    fecha_evento: row.fecha_evento ? String(row.fecha_evento) : null,
    hora_inicio: row.hora_inicio ? String(row.hora_inicio) : null,
    hora_fin: row.hora_fin ? String(row.hora_fin) : null,
    lugar: row.lugar ? String(row.lugar) : null,
    ponente: row.ponente ? String(row.ponente) : null,
    requisitos: row.requisitos ? String(row.requisitos) : null,
    cupo: row.cupo !== null && row.cupo !== undefined ? Number(row.cupo) : null,
    inscritos: Number(row.inscritos || 0),
    publico_objetivo: (row.publico_objetivo as AnuncioItem["publico_objetivo"]) || "todos",
    imagen_url: row.imagen_url ? String(row.imagen_url) : null,
    activo: row.activo !== false,
    creado_por: row.creado_por ? String(row.creado_por) : null,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

export async function fetchAnuncios(options?: {
  includeInactive?: boolean;
}): Promise<AnuncioItem[]> {
  const includeInactive = options?.includeInactive ?? false;

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from("anuncios")
        .select("*")
        .order("fecha_evento", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (!includeInactive) {
        query = query.eq("activo", true);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map((row) => mapRowToAnuncio(row as Record<string, unknown>));
        saveLocalAnuncios(mapped);
        return mapped;
      }
    } catch {
      // Fallback a almacenamiento local
    }
  }

  const local = getLocalAnuncios();
  return includeInactive ? local : local.filter((a) => a.activo);
}

export async function createAnuncio(
  input: AnuncioFormInput,
  creadoPor?: string,
): Promise<AnuncioItem> {
  const now = new Date().toISOString();
  const payload = {
    titulo: input.titulo.trim(),
    descripcion: input.descripcion.trim(),
    descripcion_larga: input.descripcion_larga?.trim() || null,
    tipo: input.tipo,
    fecha_evento: input.fecha_evento?.trim() || null,
    hora_inicio: input.hora_inicio?.trim() || null,
    hora_fin: input.hora_fin?.trim() || null,
    lugar: input.lugar?.trim() || null,
    ponente: input.ponente?.trim() || null,
    requisitos: input.requisitos?.trim() || null,
    cupo: input.cupo && input.cupo > 0 ? Number(input.cupo) : null,
    publico_objetivo: input.publico_objetivo,
    imagen_url: input.imagen_url?.trim() || null,
    activo: input.activo,
    creado_por: creadoPor || null,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from("anuncios").insert(payload).select("*").single();

      if (!error && data) {
        const created = mapRowToAnuncio(data as Record<string, unknown>);
        const current = getLocalAnuncios();
        saveLocalAnuncios([created, ...current.filter((a) => a.id !== created.id)]);
        return created;
      }
    } catch {
      // Fallback local
    }
  }

  const createdLocal: AnuncioItem = {
    id: crypto.randomUUID(),
    ...payload,
    inscritos: 0,
    created_at: now,
    updated_at: now,
  };
  const current = getLocalAnuncios();
  saveLocalAnuncios([createdLocal, ...current]);
  return createdLocal;
}

export async function updateAnuncio(id: string, input: AnuncioFormInput): Promise<AnuncioItem> {
  const now = new Date().toISOString();
  const payload = {
    titulo: input.titulo.trim(),
    descripcion: input.descripcion.trim(),
    descripcion_larga: input.descripcion_larga?.trim() || null,
    tipo: input.tipo,
    fecha_evento: input.fecha_evento?.trim() || null,
    hora_inicio: input.hora_inicio?.trim() || null,
    hora_fin: input.hora_fin?.trim() || null,
    lugar: input.lugar?.trim() || null,
    ponente: input.ponente?.trim() || null,
    requisitos: input.requisitos?.trim() || null,
    cupo: input.cupo && input.cupo > 0 ? Number(input.cupo) : null,
    publico_objetivo: input.publico_objetivo,
    imagen_url: input.imagen_url?.trim() || null,
    activo: input.activo,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("anuncios")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();

      if (!error && data) {
        const updated = mapRowToAnuncio(data as Record<string, unknown>);
        const current = getLocalAnuncios();
        saveLocalAnuncios(current.map((a) => (a.id === id ? updated : a)));
        return updated;
      }
    } catch {
      // Fallback local
    }
  }

  const current = getLocalAnuncios();
  let updatedItem: AnuncioItem | null = null;
  const nextList = current.map((a) => {
    if (a.id !== id) return a;
    updatedItem = {
      ...a,
      ...payload,
    };
    return updatedItem;
  });
  saveLocalAnuncios(nextList);

  if (!updatedItem) {
    throw new Error("No se encontró el anuncio para actualizar.");
  }
  return updatedItem;
}

export async function toggleAnuncioActivo(id: string, activo: boolean): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from("anuncios")
        .update({ activo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (!error) {
        const current = getLocalAnuncios();
        saveLocalAnuncios(current.map((a) => (a.id === id ? { ...a, activo } : a)));
        return;
      }
    } catch {
      // Fallback local
    }
  }

  const current = getLocalAnuncios();
  saveLocalAnuncios(current.map((a) => (a.id === id ? { ...a, activo } : a)));
}

export async function deleteAnuncio(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from("anuncios").delete().eq("id", id);
      if (!error) {
        const current = getLocalAnuncios();
        saveLocalAnuncios(current.filter((a) => a.id !== id));
        return;
      }
    } catch {
      // Fallback local
    }
  }

  const current = getLocalAnuncios();
  saveLocalAnuncios(current.filter((a) => a.id !== id));
}

export async function fetchMisInscripciones(estudianteId?: string): Promise<string[]> {
  if (!estudianteId) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("anuncios_inscripciones")
        .select("anuncio_id")
        .eq("estudiante_id", estudianteId);

      if (!error && Array.isArray(data)) {
        return data.map((row: { anuncio_id: string }) => String(row.anuncio_id));
      }
    } catch {
      // Fallback local
    }
  }

  return getLocalInscripciones()
    .filter((item) => item.estudiante_id === estudianteId)
    .map((item) => item.anuncio_id);
}

export async function inscribirseAnuncio(
  anuncioId: string,
  estudianteId?: string,
): Promise<{ inscritos: number }> {
  if (!estudianteId) {
    throw new Error("Inicia sesión para inscribirte en este anuncio.");
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from("anuncios_inscripciones").insert({
        anuncio_id: anuncioId,
        estudiante_id: estudianteId,
      });

      if (error) {
        if (error.message?.toLowerCase().includes("cupo")) {
          throw new Error("Cupo lleno para este anuncio o taller.");
        }
      } else {
        const { data: updatedRow } = await supabase
          .from("anuncios")
          .select("inscritos")
          .eq("id", anuncioId)
          .single();
        return { inscritos: Number(updatedRow?.inscritos ?? 0) };
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Cupo lleno")) {
        throw err;
      }
    }
  }

  const anuncios = getLocalAnuncios();
  const target = anuncios.find((a) => a.id === anuncioId);
  if (!target) {
    throw new Error("El anuncio seleccionado ya no está disponible.");
  }
  if (target.cupo !== null && target.cupo !== undefined && target.inscritos >= target.cupo) {
    throw new Error("Cupo lleno para este anuncio o taller.");
  }

  const inscripciones = getLocalInscripciones();
  const already = inscripciones.some(
    (i) => i.anuncio_id === anuncioId && i.estudiante_id === estudianteId,
  );
  if (!already) {
    saveLocalInscripciones([
      ...inscripciones,
      {
        id: crypto.randomUUID(),
        anuncio_id: anuncioId,
        estudiante_id: estudianteId,
        fecha: new Date().toISOString(),
      },
    ]);
  }

  const nextInscritos = already ? target.inscritos : target.inscritos + 1;
  saveLocalAnuncios(
    anuncios.map((a) => (a.id === anuncioId ? { ...a, inscritos: nextInscritos } : a)),
  );
  return { inscritos: nextInscritos };
}

export async function cancelarInscripcionAnuncio(
  anuncioId: string,
  estudianteId?: string,
): Promise<{ inscritos: number }> {
  if (!estudianteId) {
    throw new Error("Inicia sesión para gestionar tu inscripción.");
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from("anuncios_inscripciones")
        .delete()
        .eq("anuncio_id", anuncioId)
        .eq("estudiante_id", estudianteId);

      if (!error) {
        const { data: updatedRow } = await supabase
          .from("anuncios")
          .select("inscritos")
          .eq("id", anuncioId)
          .single();
        return { inscritos: Number(updatedRow?.inscritos ?? 0) };
      }
    } catch {
      // Fallback local
    }
  }

  const inscripciones = getLocalInscripciones();
  const hadRegistration = inscripciones.some(
    (i) => i.anuncio_id === anuncioId && i.estudiante_id === estudianteId,
  );
  saveLocalInscripciones(
    inscripciones.filter((i) => !(i.anuncio_id === anuncioId && i.estudiante_id === estudianteId)),
  );

  const anuncios = getLocalAnuncios();
  let nextInscritos = 0;
  saveLocalAnuncios(
    anuncios.map((a) => {
      if (a.id !== anuncioId) return a;
      nextInscritos = hadRegistration ? Math.max(0, a.inscritos - 1) : a.inscritos;
      return { ...a, inscritos: nextInscritos };
    }),
  );

  return { inscritos: nextInscritos };
}
