import { useState, useEffect, useCallback } from "react";
import type { MoodCheckIn, MoodId } from "./types";
import { saveCheckIn } from "./api-client";
import { DEMO_MODE } from "./mock-data";
import { mapCheckInRiskRD02 } from "./metric-rules";
import { isSupabaseConfigured, supabase } from "./supabase";

export const MOOD_STORAGE_KEY = "equilibra_mood_checkins_v1";
export const DEFAULT_MOCK_MOOD_DISPLAY = 3.4;
export const DEFAULT_MOCK_MOOD_PROGRESS = 76;

const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reglas de mapeo (la escala interna 1-5 ya definida se mantiene intacta:
 * Feliz=1, Bien=2, Normal=3, Triste=4, Muy mal=5)
 */
export const MOOD_TO_INTERNAL_VALUE: Record<MoodId, 1 | 2 | 3 | 4 | 5> = {
  "muy-bien": 1, // Feliz = 1
  bien: 2, // Bien = 2
  regular: 3, // Normal = 3
  triste: 4, // Triste = 4
  "muy-mal": 5, // Muy mal = 5
};

export const INTERNAL_VALUE_TO_MOOD: Record<number, MoodId> = {
  1: "muy-bien",
  2: "bien",
  3: "regular",
  4: "triste",
  5: "muy-mal",
};

/**
 * Conversión inversa entre score mostrado (1 a 5, donde 5=Excelente ánimo)
 * y valor interno (1 a 5, donde 1=Feliz)
 * Regla: valorMostrado = 6 - promedioInterno  =>  promedioInterno = 6 - valorMostrado
 */
export function displayedScoreToInternalValue(displayedScore: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(displayedScore);
  const clamped = Math.max(1, Math.min(5, rounded));
  const internal = 6 - clamped;
  return Math.max(1, Math.min(5, internal)) as 1 | 2 | 3 | 4 | 5;
}

export function internalValueToDisplayedScore(internalValue: number): number {
  return 6 - internalValue;
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalDateStr(isoStr?: string | null): string {
  if (!isoStr) return getTodayDateStr();
  const parsed = new Date(isoStr);
  if (Number.isNaN(parsed.getTime())) return isoStr.slice(0, 10);
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getStoredMoodCheckIns(): MoodCheckIn[] {
  if (USE_LIVE_SUPABASE) return [];
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MOOD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Determina si una fecha (YYYY-MM-DD) se encuentra en los últimos 7 días
 * (desde 6 días atrás hasta hoy inclusive).
 */
export function isWithinLast7Days(dateStr: string, referenceDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return false;
  const [year, month, day] = parts;
  const recordDate = new Date(year, month - 1, day);
  recordDate.setHours(0, 0, 0, 0);

  const refDate = new Date(referenceDate);
  refDate.setHours(0, 0, 0, 0);

  const diffMs = refDate.getTime() - recordDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays < 7;
}

export interface MoodStatsResult {
  hasRecords: boolean;
  promedioInterno: number | null;
  valorMostrado: number;
  displayValue: string;
  progress: number;
  totalRecordsInWindow: number;
}

export function calculateMoodStats(records: MoodCheckIn[]): MoodStatsResult {
  const last7 = records.filter((r) => isWithinLast7Days(r.date));
  if (last7.length === 0) {
    if (USE_LIVE_SUPABASE) {
      return {
        hasRecords: false,
        promedioInterno: null,
        valorMostrado: 0,
        displayValue: "0.0",
        progress: 0,
        totalRecordsInWindow: 0,
      };
    }
    return {
      hasRecords: false,
      promedioInterno: null,
      valorMostrado: DEFAULT_MOCK_MOOD_DISPLAY,
      displayValue: DEFAULT_MOCK_MOOD_DISPLAY.toFixed(1),
      progress: DEFAULT_MOCK_MOOD_PROGRESS,
      totalRecordsInWindow: 0,
    };
  }

  const sum = last7.reduce((acc, r) => acc + r.value, 0);
  const promedioInterno = sum / last7.length;

  // Regla 3: valorMostrado = 6 - promedio (así 5 = excelente ánimo, 1 = requiere apoyo)
  const rawValorMostrado = 6 - promedioInterno;
  const clampedDisplay = Math.max(1, Math.min(5, rawValorMostrado));
  const progress = Math.min(100, Math.max(0, Math.round((clampedDisplay / 5) * 100)));

  return {
    hasRecords: true,
    promedioInterno,
    valorMostrado: clampedDisplay,
    displayValue: clampedDisplay.toFixed(1),
    progress,
    totalRecordsInWindow: last7.length,
  };
}

export function getTodayMoodCheckIn(): MoodCheckIn | null {
  const todayStr = getTodayDateStr();
  const records = getStoredMoodCheckIns();
  return records.find((r) => r.date === todayStr) || null;
}

/**
 * Guarda o actualiza el registro MoodCheckIn del día actual.
 * En modo en vivo sincroniza directamente con `checkins` en Supabase (salvo `skipCloudSync`).
 */
export function saveMoodCheckInToday(
  moodIdOrScore: MoodId | number,
  options?: { skipCloudSync?: boolean; userId?: string },
): MoodCheckIn {
  const todayStr = getTodayDateStr();

  let moodId: MoodId;
  let internalValue: 1 | 2 | 3 | 4 | 5;

  if (typeof moodIdOrScore === "number") {
    internalValue = displayedScoreToInternalValue(moodIdOrScore);
    moodId = INTERNAL_VALUE_TO_MOOD[internalValue] || "regular";
  } else {
    moodId = moodIdOrScore;
    internalValue = MOOD_TO_INTERNAL_VALUE[moodId] || 3;
  }

  const newRecord: MoodCheckIn = {
    date: todayStr,
    value: internalValue,
    moodId,
    createdAt: new Date().toISOString(),
  };

  if (USE_LIVE_SUPABASE) {
    if (!options?.skipCloudSync) {
      const explicitUid =
        options?.userId && UUID_REGEX.test(options.userId) ? options.userId : undefined;
      saveCheckIn(
        {
          id: crypto.randomUUID(),
          studentId: explicitUid || "",
          academicLoad: internalValue,
          emotions: [moodId],
          intensity: Math.min(10, Math.max(1, internalValue * 2)),
          createdAt: newRecord.createdAt || new Date().toISOString(),
          riskLevel: mapCheckInRiskRD02(internalValue),
        },
        explicitUid,
        { silentNotice: true },
      )
        .then(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("equilibra-mood-update", {
                detail: { record: newRecord },
              }),
            );
          }
        })
        .catch(() => {});
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("equilibra-mood-update", {
          detail: { record: newRecord },
        }),
      );
    }
    return newRecord;
  }

  const records = getStoredMoodCheckIns();
  const existingIndex = records.findIndex((r) => r.date === todayStr);
  if (existingIndex >= 0) {
    records[existingIndex] = newRecord;
  } else {
    records.push(newRecord);
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(records));
      window.dispatchEvent(
        new CustomEvent("equilibra-mood-update", {
          detail: { record: newRecord, records },
        }),
      );
    } catch {
      // LocalStorage fallback
    }
  }

  if (!options?.skipCloudSync) {
    try {
      saveCheckIn(
        {
          id: `mood-${todayStr}`,
          studentId: "demo-student-dess",
          academicLoad: internalValue,
          emotions: [moodId],
          createdAt: new Date().toISOString(),
          riskLevel: mapCheckInRiskRD02(internalValue),
        },
        undefined,
        { silentNotice: true },
      ).catch(() => {});
    } catch {
      // Demo fallback
    }
  }

  return newRecord;
}

async function fetchLiveMoodRecords(): Promise<MoodCheckIn[]> {
  const { data: authData } = await supabase.auth.getUser();
  const uid = authData?.user?.id;
  if (!uid || !UUID_REGEX.test(uid)) {
    return [];
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from("checkins")
    .select("id, escala, emociones, creado_en")
    .eq("user_id", uid)
    .gte("creado_en", sevenDaysAgo.toISOString())
    .order("creado_en", { ascending: false });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    const rawScale = typeof row.escala === "number" ? row.escala : 3;
    const clampedScale = Math.max(1, Math.min(5, Math.round(rawScale))) as 1 | 2 | 3 | 4 | 5;
    const moodId = INTERNAL_VALUE_TO_MOOD[clampedScale] || "regular";
    return {
      date: toLocalDateStr(row.creado_en ? String(row.creado_en) : null),
      value: clampedScale,
      moodId,
      createdAt: row.creado_en ? String(row.creado_en) : undefined,
    };
  });
}

/**
 * Hook reactivo para consultar y actualizar el estado y métricas del ánimo
 */
export function useMoodStats() {
  const [records, setRecords] = useState<MoodCheckIn[]>(() =>
    USE_LIVE_SUPABASE ? [] : getStoredMoodCheckIns(),
  );

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      if (USE_LIVE_SUPABASE) {
        const live = await fetchLiveMoodRecords();
        if (active) setRecords(live);
      } else if (active) {
        setRecords(getStoredMoodCheckIns());
      }
    };

    void loadRecords();

    const handleUpdate = () => {
      void loadRecords();
    };

    window.addEventListener("equilibra-mood-update", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    let authSubscription: { unsubscribe: () => void } | null = null;
    if (USE_LIVE_SUPABASE) {
      const { data } = supabase.auth.onAuthStateChange(() => {
        void loadRecords();
      });
      authSubscription = data.subscription;
    }

    return () => {
      active = false;
      window.removeEventListener("equilibra-mood-update", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      authSubscription?.unsubscribe();
    };
  }, []);

  const stats = calculateMoodStats(records);
  const todayStr = getTodayDateStr();
  const todayRecord = records.find((r) => r.date === todayStr) || null;
  const todayMood = todayRecord ? todayRecord.moodId : null;

  const saveToday = useCallback((moodIdOrScore: MoodId | number) => {
    return saveMoodCheckInToday(moodIdOrScore);
  }, []);

  return {
    ...stats,
    records,
    todayRecord,
    todayMood,
    saveTodayMood: saveToday,
  };
}
