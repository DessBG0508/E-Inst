import { DEMO_MODE } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { saveCheckIn } from "@/lib/api-client";
import { mapCheckInRiskRD02 } from "@/lib/metric-rules";
import { saveMoodCheckInToday } from "@/lib/mood-store";
import type { CheckIn, MoodId } from "@/lib/types";

export type CheckInEmotionId = "bien" | "regular" | "neutral" | "mal" | "muy-mal";

export interface CheckInHistoryEntry {
  id: string;
  emotionId: CheckInEmotionId;
  emotionLabel: string;
  intensity: number; // 1 a 10
  note?: string;
  createdAt: string;
}

const HISTORY_STORAGE_KEY = "equilibra_checkin_history_v2";
const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SCALE_TO_EMOTION: Record<number, { id: CheckInEmotionId; label: string }> = {
  1: { id: "bien", label: "Bien" },
  2: { id: "regular", label: "Regular" },
  3: { id: "neutral", label: "Neutral" },
  4: { id: "mal", label: "Mal" },
  5: { id: "muy-mal", label: "Muy mal" },
};

export const EMOTION_TO_SCALE: Record<CheckInEmotionId, 1 | 2 | 3 | 4 | 5> = {
  bien: 1,
  regular: 2,
  neutral: 3,
  mal: 4,
  "muy-mal": 5,
};

const EMOTION_TO_MOOD_STORE: Record<CheckInEmotionId, MoodId> = {
  bien: "bien",
  regular: "regular",
  neutral: "regular",
  mal: "triste",
  "muy-mal": "muy-mal",
};

function getStorageKey(userId?: string): string {
  return userId ? `${HISTORY_STORAGE_KEY}_${userId}` : HISTORY_STORAGE_KEY;
}

export function getLocalCheckInHistory(userId?: string): CheckInHistoryEntry[] {
  if (USE_LIVE_SUPABASE) return [];
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 7);
  } catch {
    return [];
  }
}

function saveLocalCheckInHistory(entries: CheckInHistoryEntry[], userId?: string): void {
  if (USE_LIVE_SUPABASE) return;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(entries.slice(0, 20)));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchRecentCheckInHistory(userId?: string): Promise<CheckInHistoryEntry[]> {
  if (!USE_LIVE_SUPABASE) {
    return getLocalCheckInHistory(userId).slice(0, 7);
  }

  let activeUserId = userId && UUID_REGEX.test(userId) ? userId : undefined;
  if (!activeUserId) {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id && UUID_REGEX.test(authData.user.id)) {
      activeUserId = authData.user.id;
    }
  }

  if (!activeUserId) {
    return [];
  }

  const { data, error } = await supabase
    .from("checkins")
    .select("id, escala, emociones, intensidad, nota, creado_en")
    .eq("user_id", activeUserId)
    .order("creado_en", { ascending: false })
    .limit(7);

  if (error) {
    throw new Error(`No se pudo consultar tu historial de check-ins: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data.map((row) => {
    const escala = typeof row.escala === "number" ? row.escala : 3;
    const fallbackMeta = SCALE_TO_EMOTION[escala] || { id: "neutral", label: "Neutral" };
    const tags = Array.isArray(row.emociones) ? row.emociones.map(String) : [];

    const intensityTag = tags.find((t) => t.startsWith("intensidad:"));
    const parsedIntensityFromTag = intensityTag
      ? Math.min(10, Math.max(1, Number.parseInt(intensityTag.split(":")[1] || "5", 10) || 5))
      : Math.min(10, Math.max(1, escala * 2));
    const parsedIntensity =
      typeof row.intensidad === "number"
        ? Math.min(10, Math.max(1, row.intensidad))
        : parsedIntensityFromTag;

    const noteTag = tags.find((t) => t.startsWith("nota:"));
    const parsedNoteFromTag = noteTag ? noteTag.slice(5).trim() : undefined;
    const parsedNote =
      typeof row.nota === "string" && row.nota.trim().length > 0
        ? row.nota.trim()
        : parsedNoteFromTag;

    const labelTag = tags.find((t) => !t.startsWith("intensidad:") && !t.startsWith("nota:"));
    const matchedEntry = Object.entries(SCALE_TO_EMOTION).find(
      ([, val]) => val.label.toLowerCase() === (labelTag || "").toLowerCase(),
    );

    return {
      id: String(row.id || crypto.randomUUID()),
      emotionId: matchedEntry ? matchedEntry[1].id : fallbackMeta.id,
      emotionLabel: matchedEntry ? matchedEntry[1].label : fallbackMeta.label,
      intensity: parsedIntensity,
      note: parsedNote || undefined,
      createdAt: String(row.creado_en || new Date().toISOString()),
    };
  });
}

export async function submitEmotionalCheckIn(params: {
  emotionId: CheckInEmotionId;
  emotionLabel: string;
  intensity: number;
  note: string;
  userId?: string;
}): Promise<CheckInHistoryEntry> {
  const { emotionId, emotionLabel, intensity, note, userId } = params;
  const trimmedNote = note.trim().slice(0, 280);
  const escala = EMOTION_TO_SCALE[emotionId];
  const createdAt = new Date().toISOString();

  const tags = [emotionLabel, `intensidad:${intensity}`];
  if (trimmedNote) {
    tags.push(`nota:${trimmedNote}`);
  }

  const checkInPayload: CheckIn = {
    id: crypto.randomUUID(),
    studentId: userId || (USE_LIVE_SUPABASE ? "" : "demo-student-dess"),
    academicLoad: escala,
    emotions: tags,
    intensity,
    note: trimmedNote || undefined,
    createdAt,
    riskLevel: mapCheckInRiskRD02(escala),
  };

  const saved = await saveCheckIn(checkInPayload, userId, { silentNotice: true });

  // Sincronizar estado reactivo del ánimo sin duplicar inserción en Supabase
  saveMoodCheckInToday(EMOTION_TO_MOOD_STORE[emotionId], {
    skipCloudSync: true,
    userId,
  });

  const entry: CheckInHistoryEntry = {
    id: saved.id || checkInPayload.id,
    emotionId,
    emotionLabel,
    intensity,
    note: trimmedNote || undefined,
    createdAt: saved.createdAt || createdAt,
  };

  if (!USE_LIVE_SUPABASE) {
    const prev = getLocalCheckInHistory(userId);
    saveLocalCheckInHistory([entry, ...prev.filter((item) => item.id !== entry.id)], userId);
  }

  return entry;
}
