import { DEMO_MODE } from "@/lib/mock-data";
import { psychoResources } from "@/lib/resources-data";
import type {
  CanonicalResourceCategory,
  PsychoResource,
  ResourceCategory,
  VideoOrientation,
} from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;
const STORAGE_KEY = "equilibra_recursos_catalogo_v1";
const DELETED_SEEDS_KEY = "equilibra_recursos_deleted_seeds_v1";

export const CANONICAL_RESOURCE_CATEGORIES: CanonicalResourceCategory[] = [
  "Ansiedad",
  "Depresión",
  "Sueño",
  "Relaciones",
  "Estrés académico",
];

export function normalizeResourceCategory(category?: string): CanonicalResourceCategory {
  switch (category) {
    case "Ansiedad":
    case "Respiración":
      return "Ansiedad";
    case "Depresión":
    case "Ánimo":
      return "Depresión";
    case "Sueño":
      return "Sueño";
    case "Relaciones":
      return "Relaciones";
    case "Estrés académico":
    case "Estrés":
      return "Estrés académico";
    default:
      return "Ansiedad";
  }
}

function toDbResourceCategory(
  category?: string,
): "Ansiedad" | "Estrés" | "Sueño" | "Ánimo" | "Respiración" {
  switch (category) {
    case "Ansiedad":
      return "Ansiedad";
    case "Respiración":
      return "Respiración";
    case "Sueño":
      return "Sueño";
    case "Estrés académico":
    case "Estrés":
      return "Estrés";
    case "Depresión":
    case "Ánimo":
    case "Relaciones":
      return "Ánimo";
    default:
      return "Ansiedad";
  }
}

export interface CategoryVisualStyle {
  label: CanonicalResourceCategory;
  hex: string;
  pillClass: string;
  softBgClass: string;
  accentTextClass: string;
}

export function getCategoryVisuals(category: ResourceCategory): CategoryVisualStyle {
  const normalized = normalizeResourceCategory(category);
  switch (normalized) {
    case "Ansiedad":
      return {
        label: "Ansiedad",
        hex: "#7B6FD8",
        pillClass: "bg-[#7B6FD8] text-white border-[#7B6FD8]",
        softBgClass: "bg-[#ECE8FA] text-[#5346B8] border-[#7B6FD8]/30",
        accentTextClass: "text-[#7B6FD8]",
      };
    case "Depresión":
      return {
        label: "Depresión",
        hex: "#8FC9B5",
        pillClass: "bg-[#8FC9B5] text-[#1A1A1A] border-[#8FC9B5]",
        softBgClass: "bg-[#E0F0E8] text-[#1F4D2C] border-[#8FC9B5]/60",
        accentTextClass: "text-[#2E7D60]",
      };
    case "Sueño":
      return {
        label: "Sueño",
        hex: "#F5C7A8",
        pillClass: "bg-[#F5C7A8] text-[#1A1A1A] border-[#F5C7A8]",
        softBgClass: "bg-[#FBE6D5] text-[#7A4419] border-[#F5C7A8]",
        accentTextClass: "text-[#9A5826]",
      };
    case "Relaciones":
      return {
        label: "Relaciones",
        hex: "#B8860B",
        pillClass: "bg-[#B8860B] text-white border-[#B8860B]",
        softBgClass: "bg-[#FDF6E2] text-[#8C6505] border-[#B8860B]/35",
        accentTextClass: "text-[#B8860B]",
      };
    case "Estrés académico":
      return {
        label: "Estrés académico",
        hex: "#1F4D2C",
        pillClass: "bg-[#1F4D2C] text-white border-[#1F4D2C]",
        softBgClass: "bg-[#E0F0E8] text-[#1F4D2C] border-[#1F4D2C]/30",
        accentTextClass: "text-[#1F4D2C]",
      };
  }
}

/**
 * Determina si la URL corresponde a un video externo que debe reproducirse en iframe (YouTube o Vimeo)
 */
export function isExternalEmbedVideo(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.includes("youtube.com") ||
    trimmed.includes("youtube-nocookie.com") ||
    trimmed.includes("youtu.be") ||
    trimmed.includes("vimeo.com")
  );
}

/**
 * Determina si la URL corresponde a un archivo de video directo (MP4, WebM, MOV, Blob o IndexedDB)
 */
export function isDirectVideoFile(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("indexeddb://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:video") ||
    trimmed.endsWith(".mp4") ||
    trimmed.endsWith(".webm") ||
    trimmed.endsWith(".ogg") ||
    trimmed.endsWith(".mov") ||
    trimmed.includes("storage.supabase.co") ||
    trimmed.includes("/storage/v1/object/public/")
  );
}

/**
 * Detecta la orientación inicial a partir de la preferencia explícita o patrones en la URL (ej. YouTube Shorts)
 */
export function detectVideoOrientation(
  url?: string,
  explicit?: VideoOrientation,
): "horizontal" | "vertical" | "square" {
  if (explicit && explicit !== "auto") {
    return explicit;
  }
  if (url) {
    const lower = url.toLowerCase();
    if (lower.includes("youtube.com/shorts/") || lower.includes("/shorts/")) {
      return "vertical";
    }
  }
  return "horizontal";
}

/**
 * Extrae el ID de 11 caracteres de cualquier formato de URL de YouTube.
 */
function extractYouTubeId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      const vParam = parsed.searchParams.get("v");
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;

      const segments = parsed.pathname.split("/").filter(Boolean);
      if (
        segments.length >= 2 &&
        (segments[0] === "shorts" ||
          segments[0] === "embed" ||
          segments[0] === "live" ||
          segments[0] === "v") &&
        /^[a-zA-Z0-9_-]{11}$/.test(segments[1])
      ) {
        return segments[1];
      }
    }
  } catch {
    // Fallback regex si la URL viene sin protocolo completo
  }

  const regexMatch = rawUrl.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return regexMatch ? regexMatch[1] : null;
}

/**
 * Convierte URLs estándar de YouTube (watch, youtu.be, shorts, live, embed) y Vimeo a formato embed seguro para iframes.
 */
export function getEmbedVideoUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const youtubeId = extractYouTubeId(trimmed);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}`;
  }

  // Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return trimmed;
}

/**
 * Recursos iniciales enriquecidos con videos demostrativos institucionales y guías de lectura
 */
const SEEDED_RESOURCES: PsychoResource[] = [
  {
    ...psychoResources[0],
    format: "video",
    videoUrl: "https://www.youtube.com/watch?v=T38xzsKv3GQ",
    videoTitle: "Técnica Guiada de Respiración Abdominal y Diafragmática",
    videoOrientation: "horizontal",
    author: "Área de Psicología TESH",
    updatedAt: "Oct 2026",
    active: true,
  },
  {
    ...psychoResources[8],
    format: "video",
    videoUrl: "https://www.youtube.com/shorts/VWTwOXjOuMM",
    videoTitle: "Respiración Cuadrada 4-4-4-4 Guiada (Formato Vertical)",
    videoOrientation: "vertical",
    readTime: "3 min de práctica",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
  },
  {
    id: "rec-respiracion-478-lectura",
    title: "Guía de Respiración 4-7-8 para Bajar Pulsaciones",
    shortDescription:
      "Método paso a paso de lectura rápida para calmar el sistema nervioso antes de dormir o presentar un examen.",
    category: "Ansiedad",
    readTime: "3 min de lectura",
    iconName: "wind",
    tone: "mint",
    format: "lectura",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
    content: [
      "La técnica 4-7-8 actúa como un freno fisiológico natural cuando sientes palpitaciones rápidas o tensión en el pecho por presión académica.",
      "Para aplicarla, coloca la punta de la lengua suavemente detrás de tus dientes frontales superiores. Inhala en silencio por la nariz contando 4 segundos, sostén el aire 7 segundos sin forzar la garganta y exhala despacio por la boca durante 8 segundos.",
      "Al prolongar la exhalación al doble de la inhalación, activas el nervio vago y envías una señal directa de calma a tu corazón. Realiza un máximo de cuatro ciclos seguidos y descansa.",
    ],
    keyTakeaway:
      "Inhala en 4, sostén en 7 y exhala lento en 8: alargar la exhalación reduce la activación física en menos de dos minutos.",
  },
  {
    ...psychoResources[1],
    format: "video",
    videoUrl: "https://www.youtube.com/watch?v=30VMIEmA114",
    videoTitle: "Técnica de Anclaje 5-4-3-2-1 para Calmar la Ansiedad en Minutos",
    videoOrientation: "horizontal",
    author: "Área de Psicología TESH",
    updatedAt: "Oct 2026",
    active: true,
  },
  {
    id: "rec-relajacion-muscular-jacobson",
    title: "Relajación Muscular Progresiva de Jacobson",
    shortDescription:
      "Aprende a liberar la tensión física acumulada en hombros, cuello y mandíbula tras jornadas largas de estudio.",
    category: "Estrés académico",
    readTime: "6 min de práctica",
    iconName: "feather",
    tone: "teal",
    format: "video",
    videoUrl: "https://www.youtube.com/watch?v=ihO02wUzgkc",
    videoTitle: "Guía Demostrativa de Relajación Muscular Progresiva",
    videoOrientation: "horizontal",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
    content: [
      "El estrés académico continuado provoca que mantengamos micro-contracciones involuntarias en los músculos del cuello, los hombros y la espalda.",
      "La técnica de Jacobson consiste en tensar conscientemente un grupo muscular durante 5 segundos y luego soltarlo de golpe, prestando atención a la sensación de alivio y calor que genera la relajación.",
      "Practica esta secuencia sentado cómodamente con los pies en el suelo: manos en puño, hombros hacia las orejas y mandíbula suave.",
    ],
    keyTakeaway:
      "Tensa 5 segundos, suelta de golpe y siente el contraste: el cuerpo relajado calma la mente agitada.",
  },
  {
    ...psychoResources[2],
    format: "video",
    videoUrl: "https://www.youtube.com/watch?v=vFrHhwCOaW0",
    videoTitle: "Meditación Guiada de 13 Minutos para Dormir Profundamente",
    videoOrientation: "horizontal",
    readTime: "13 min de práctica",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
  },
  {
    id: "rec-meditacion-nocturna-video",
    title: "Meditación Nocturna para Calmar la Mente",
    shortDescription:
      "Audio-video guiado para desacelerar pensamientos repetitivos antes de acostarte y favorecer un descanso continuo.",
    category: "Sueño",
    readTime: "6 min de práctica",
    iconName: "moon",
    tone: "lavender",
    format: "video",
    videoUrl: "https://www.youtube.com/watch?v=-z4x6Fv23Kw",
    videoTitle: "Meditación Guiada para Dormir y Soltar Preocupaciones",
    videoOrientation: "horizontal",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
    content: [
      "Cuando el día termina pero tu mente sigue repasando pendientes o conversaciones, escuchar una voz calmada ayuda a dirigir la atención lejos de la preocupación.",
      "Recuéstate en una postura cómoda, baja el brillo de la pantalla o colócala boca abajo y sigue únicamente el audio y el ritmo pausado de tu respiración.",
      "No intentes obligarte a dormir: permite que el cuerpo descanse sobre el colchón mientras sueltas el peso de los hombros y la mandíbula.",
    ],
    keyTakeaway:
      "Escucha con la luz tenue y deja que la guía sonora sostenga tu atención hasta conciliar el sueño.",
  },
  {
    ...psychoResources[5],
    format: "video",
    videoUrl: "https://www.youtube.com/watch?v=LIzAgihTcak",
    videoTitle: "¿Qué es la Tristeza y Cómo Gestionarla de Forma Saludable?",
    videoOrientation: "horizontal",
    readTime: "5 min de práctica",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
  },
  {
    id: "rec-activacion-conductual-lectura",
    title: "Activación Conductual: Pequeños Pasos en Días Difíciles",
    shortDescription:
      "Lectura práctica sobre cómo retomar actividades significativas poco a poco cuando falta energía o motivación.",
    category: "Depresión",
    readTime: "5 min de lectura",
    iconName: "sun",
    tone: "rose",
    format: "lectura",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
    content: [
      "Cuando el ánimo baja, solemos esperar a 'sentir ganas' para hacer actividades que antes disfrutábamos o necesitamos cumplir. Sin embargo, el aislamiento prolongado suele reforzar el agotamiento emocional.",
      "La activación conductual propone invertir el orden con mucha gentileza: elegir una acción pequeña y concreta (salir 10 minutos a tomar aire, ducharte, enviar un mensaje a alguien de confianza) aunque la motivación aún no esté al 100%.",
      "Cada micro-acción cumplida le demuestra a tu cerebro que aún tienes capacidad de agencia y abre espacio para pequeñas sensaciones de bienestar o alivio.",
    ],
    keyTakeaway:
      "No esperes a tener toda la energía: elige una acción de 5 minutos que te cuide hoy y reconócete el esfuerzo.",
  },
  {
    id: "rec-comunicacion-asertiva-video",
    title: "Comunicación Asertiva y Límites en el Campus",
    shortDescription:
      "Guía audiovisual para expresar desacuerdos con respeto en equipos académicos, amistades y relaciones cercanas.",
    category: "Relaciones",
    readTime: "4 min de práctica",
    iconName: "heart",
    tone: "teal",
    format: "video",
    videoUrl: "https://www.youtube.com/watch?v=0n2P5l5L0pM",
    videoTitle: "Asertividad y Escucha Activa para Estudiantes",
    videoOrientation: "horizontal",
    author: "Área de Psicología TESH",
    updatedAt: "Nov 2026",
    active: true,
    content: [
      "Construir relaciones universitarias saludables requiere comunicar expectativas a tiempo, especialmente cuando trabajamos bajo presión en proyectos de equipo.",
      "Hablar en primera persona describiendo hechos concretos y emociones propias reduce la defensividad y favorece acuerdos justos para todas las partes.",
      "Practicar escuchar sin interrumpir y validar la perspectiva del otro fortalece redes de apoyo sólidas durante toda tu carrera.",
    ],
    keyTakeaway:
      "Expresa lo que necesitas con claridad y respeto: cuidar tus límites también cuida tus vínculos.",
  },
  ...[
    psychoResources[3],
    psychoResources[4],
    psychoResources[6],
    psychoResources[7],
    psychoResources[9],
    psychoResources[10],
    psychoResources[11],
    psychoResources[12],
  ].map((rec) => ({
    ...rec,
    format: "lectura" as const,
    author: "Área de Psicología TESH",
    updatedAt: "Oct 2026",
    active: true,
  })),
];

const ENRICHED_VIDEO_SEED_IDS = new Set([
  "rec-higiene-sueno",
  "rec-pausa-compasiva",
  "rec-respiracion-cuadrada",
]);

function getDeletedSeedIds(): Set<string> {
  try {
    if (typeof localStorage === "undefined") return new Set();
    const raw = localStorage.getItem(DELETED_SEEDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function setDeletedSeedIds(ids: Set<string>): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (ids.size === 0) {
      localStorage.removeItem(DELETED_SEEDS_KEY);
    } else {
      localStorage.setItem(DELETED_SEEDS_KEY, JSON.stringify([...ids]));
    }
  } catch {
    // ignore
  }
}

/**
 * Repara URLs rotas conocidas, enriquece recursos semilla con videos verificados
 * y fusiona los ejemplos faltantes que no hayan sido eliminados manualmente.
 */
function normalizeAndMergeWithSeeds(items: PsychoResource[]): {
  resources: PsychoResource[];
  changed: boolean;
  missingSeeds: PsychoResource[];
} {
  let changed = false;
  const seedById = new Map(SEEDED_RESOURCES.map((item) => [item.id, item]));
  const deletedSeeds = getDeletedSeedIds();

  const normalized = items.map((item) => {
    let nextItem = item;
    const canonicalCategory = normalizeResourceCategory(nextItem.category);
    if (canonicalCategory !== nextItem.category) {
      changed = true;
      nextItem = { ...nextItem, category: canonicalCategory };
    }

    // Reparar automáticamente URL rota de YouTube (404) de la semilla inicial si sigue en caché o BD
    if (nextItem.videoUrl && nextItem.videoUrl.includes("1Dv-LDOGvuc")) {
      changed = true;
      nextItem = { ...nextItem, videoUrl: "https://www.youtube.com/watch?v=T38xzsKv3GQ" };
    }
    // Enriquecer recursos semilla que antes eran solo lectura si aún no tienen un video asignado
    if (ENRICHED_VIDEO_SEED_IDS.has(nextItem.id) && !nextItem.videoUrl) {
      const seedMatch = seedById.get(nextItem.id);
      if (seedMatch?.videoUrl) {
        changed = true;
        nextItem = {
          ...nextItem,
          format: "video" as const,
          videoUrl: seedMatch.videoUrl,
          videoTitle: seedMatch.videoTitle,
          videoOrientation: seedMatch.videoOrientation,
          readTime: seedMatch.readTime,
          updatedAt: seedMatch.updatedAt,
        };
      }
    }
    return nextItem;
  });

  // Incorporar nuevos recursos de ejemplo que no existan aún (ni hayan sido eliminados)
  const existingIds = new Set(normalized.map((item) => item.id));
  const missingSeeds = SEEDED_RESOURCES.filter(
    (seed) => !existingIds.has(seed.id) && !deletedSeeds.has(seed.id),
  );
  if (missingSeeds.length > 0) {
    changed = true;
    normalized.push(...missingSeeds);
  }

  return { resources: normalized, changed, missingSeeds };
}

/**
 * Obtiene todos los recursos (solo en DEMO_MODE desde LocalStorage; en modo en vivo retorna [] hasta que fetchResourcesAsync cargue de Supabase)
 */
export function getStoredResources(): PsychoResource[] {
  if (USE_LIVE_SUPABASE) {
    return [];
  }

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PsychoResource[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { resources, changed } = normalizeAndMergeWithSeeds(parsed);
          if (changed) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(resources));
            } catch {
              // ignore
            }
          }
          return resources;
        }
      }
    }
  } catch {
    // fallback
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEEDED_RESOURCES));
    }
  } catch {
    // ignore
  }

  return SEEDED_RESOURCES;
}

function mapDbRowToResource(row: Record<string, unknown>): PsychoResource {
  const rawVideoUrl = row.video_url ? String(row.video_url) : undefined;
  const repairedVideoUrl =
    rawVideoUrl && rawVideoUrl.includes("1Dv-LDOGvuc")
      ? "https://www.youtube.com/watch?v=T38xzsKv3GQ"
      : rawVideoUrl;

  return {
    id: String(row.id || crypto.randomUUID()),
    title: String(row.title || "Recurso"),
    shortDescription: String(row.short_description || ""),
    category: normalizeResourceCategory(row.category ? String(row.category) : undefined),
    readTime: String(row.read_time || "4 min"),
    iconName: (row.icon_name as PsychoResource["iconName"]) || "bookOpen",
    tone: (row.tone as PsychoResource["tone"]) || "teal",
    content: Array.isArray(row.content)
      ? (row.content as string[])
      : typeof row.content === "string"
        ? (row.content as string).split("\n\n")
        : [],
    keyTakeaway: row.key_takeaway ? String(row.key_takeaway) : undefined,
    videoUrl: repairedVideoUrl,
    videoTitle: row.video_title ? String(row.video_title) : undefined,
    videoOrientation: (row.video_orientation as VideoOrientation) || "auto",
    format: (row.format as PsychoResource["format"]) || (repairedVideoUrl ? "video" : "lectura"),
    author: row.author ? String(row.author) : "Área de Psicología TESH",
    updatedAt: row.updated_at ? String(row.updated_at).slice(0, 10) : "Hoy",
    active: row.active !== false,
  };
}

/**
 * Carga recursos asíncronamente desde Supabase (modo en vivo) o LocalStorage (DEMO_MODE)
 */
export async function fetchResourcesAsync(): Promise<PsychoResource[]> {
  if (USE_LIVE_SUPABASE) {
    const { data, error } = await supabase
      .from("recursos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`No se pudieron cargar los recursos desde Supabase: ${error.message}`);
    }

    return Array.isArray(data)
      ? data.map((row) => mapDbRowToResource(row as Record<string, unknown>))
      : [];
  }

  return getStoredResources();
}

export interface SaveResourceResult {
  resource: PsychoResource;
  syncedToDb: boolean;
  dbError?: string;
}

/**
 * Guarda o actualiza un recurso (upsert) e informa si se sincronizó en Supabase
 */
export async function saveResourceWithStatus(
  resource: Partial<PsychoResource> & { title: string },
): Promise<SaveResourceResult> {
  const id = resource.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const finalResource: PsychoResource = {
    id,
    title: resource.title.trim(),
    shortDescription: resource.shortDescription?.trim() || "",
    category: resource.category || "Ansiedad",
    readTime: resource.readTime?.trim() || "4 min de lectura",
    iconName: resource.iconName || "bookOpen",
    tone: resource.tone || "teal",
    content:
      resource.content && resource.content.length > 0
        ? resource.content
        : ["Contenido preparado por el equipo de orientación psicológica del TESH."],
    keyTakeaway: resource.keyTakeaway?.trim() || undefined,
    videoUrl: resource.videoUrl?.trim() || undefined,
    videoTitle: resource.videoTitle?.trim() || undefined,
    videoOrientation: resource.videoOrientation || "auto",
    format: resource.videoUrl?.trim() ? "video" : resource.format || "lectura",
    author: resource.author?.trim() || "Área de Psicología TESH",
    updatedAt: new Date().toLocaleDateString("es-MX", {
      month: "short",
      year: "numeric",
    }),
    active: resource.active !== false,
  };

  if (USE_LIVE_SUPABASE) {
    try {
      const { error } = await supabase.from("recursos").upsert({
        id: finalResource.id,
        title: finalResource.title,
        short_description: finalResource.shortDescription,
        category: toDbResourceCategory(finalResource.category),
        read_time: finalResource.readTime,
        icon_name: finalResource.iconName,
        tone: finalResource.tone,
        content: finalResource.content,
        key_takeaway: finalResource.keyTakeaway ?? null,
        video_url: finalResource.videoUrl ?? null,
        video_title: finalResource.videoTitle ?? null,
        video_orientation: finalResource.videoOrientation || "auto",
        format: finalResource.format,
        author: finalResource.author,
        active: finalResource.active,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return { resource: finalResource, syncedToDb: false, dbError: error.message };
      }

      return { resource: finalResource, syncedToDb: true };
    } catch (err) {
      return {
        resource: finalResource,
        syncedToDb: false,
        dbError: err instanceof Error ? err.message : "Error de conexión con Supabase",
      };
    }
  }

  const current = getStoredResources();
  const existingIndex = current.findIndex((r) => r.id === id);
  let updatedList: PsychoResource[];

  if (existingIndex >= 0) {
    updatedList = [...current];
    updatedList[existingIndex] = finalResource;
  } else {
    updatedList = [finalResource, ...current];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch {
    // ignore
  }

  return { resource: finalResource, syncedToDb: false };
}

/**
 * Guarda o actualiza un recurso (upsert)
 */
export async function saveResource(
  resource: Partial<PsychoResource> & { title: string },
): Promise<PsychoResource> {
  const { resource: saved, syncedToDb, dbError } = await saveResourceWithStatus(resource);
  if (USE_LIVE_SUPABASE && !syncedToDb) {
    throw new Error(dbError || "No se pudo guardar el recurso en Supabase.");
  }
  return saved;
}

/**
 * Elimina un recurso por su ID
 */
export async function deleteResource(id: string): Promise<boolean> {
  if (USE_LIVE_SUPABASE) {
    const { error } = await supabase.from("recursos").delete().eq("id", id);
    if (error) {
      throw new Error(`No se pudo eliminar el recurso: ${error.message}`);
    }
    return true;
  }

  const current = getStoredResources();
  const updated = current.filter((r) => r.id !== id);

  if (SEEDED_RESOURCES.some((seed) => seed.id === id)) {
    const deletedSeeds = getDeletedSeedIds();
    deletedSeeds.add(id);
    setDeletedSeedIds(deletedSeeds);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  return true;
}

/**
 * Alterna el estado activo/inactivo de un recurso
 */
export async function toggleResourceActive(id: string, currentActive?: boolean): Promise<boolean> {
  if (USE_LIVE_SUPABASE) {
    let resolvedCurrent = currentActive;
    if (resolvedCurrent === undefined) {
      const { data: existingRow, error: readErr } = await supabase
        .from("recursos")
        .select("active")
        .eq("id", id)
        .single();
      if (readErr) {
        throw new Error(`No se pudo consultar el recurso: ${readErr.message}`);
      }
      resolvedCurrent = existingRow?.active !== false;
    }

    const nextActive = !resolvedCurrent;
    const { data, error } = await supabase
      .from("recursos")
      .update({ active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("active")
      .single();

    if (error) {
      throw new Error(`No se pudo actualizar la visibilidad del recurso: ${error.message}`);
    }
    return data?.active !== false;
  }

  const current = getStoredResources();
  const index = current.findIndex((r) => r.id === id);
  if (index >= 0) {
    const updated = [...current];
    updated[index] = { ...updated[index], active: !updated[index].active };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated[index].active ?? true;
  }
  return false;
}

/**
 * Restaura los recursos a los valores predeterminados institucionales en Supabase o localStorage
 */
export async function resetResourcesToDefault(): Promise<PsychoResource[]> {
  if (USE_LIVE_SUPABASE) {
    const { error } = await supabase.from("recursos").upsert(
      SEEDED_RESOURCES.map((r) => ({
        id: r.id,
        title: r.title,
        short_description: r.shortDescription,
        category: toDbResourceCategory(r.category),
        read_time: r.readTime,
        icon_name: r.iconName,
        tone: r.tone,
        content: r.content,
        key_takeaway: r.keyTakeaway ?? null,
        video_url: r.videoUrl ?? null,
        video_title: r.videoTitle ?? null,
        video_orientation: r.videoOrientation || "auto",
        format: r.format || "lectura",
        author: r.author || "Área de Psicología TESH",
        active: r.active !== false,
        updated_at: new Date().toISOString(),
      })),
    );
    if (error) {
      throw new Error(`No se pudo restaurar el catálogo oficial en Supabase: ${error.message}`);
    }
    return fetchResourcesAsync();
  }

  setDeletedSeedIds(new Set());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEEDED_RESOURCES));
  } catch {
    // ignore
  }
  return SEEDED_RESOURCES;
}
