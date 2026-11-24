import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type DailyMoodKey = "bien" | "regular" | "neutral" | "mal" | "muy-mal";

interface MoodOption {
  id: DailyMoodKey;
  emoji: string;
  label: string;
  solidBgClass: string;
  selectedTextClass: string;
  ringColorClass: string;
  borderIdleClass: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  {
    id: "bien",
    emoji: "😊",
    label: "Bien",
    solidBgClass: "bg-[#F5C7A8] border-[#F5C7A8]",
    selectedTextClass: "text-[#1A1A1A]",
    ringColorClass: "ring-[#F5C7A8]",
    borderIdleClass: "border-[#F5C7A8] hover:bg-[#FBE6D5]",
  },
  {
    id: "regular",
    emoji: "🙂",
    label: "Regular",
    solidBgClass: "bg-[#8FC9B5] border-[#8FC9B5]",
    selectedTextClass: "text-[#1A1A1A]",
    ringColorClass: "ring-[#8FC9B5]",
    borderIdleClass: "border-[#8FC9B5] hover:bg-[#E0F0E8]",
  },
  {
    id: "neutral",
    emoji: "😐",
    label: "Neutral",
    solidBgClass: "bg-[#7B6FD8] border-[#7B6FD8]",
    selectedTextClass: "text-white",
    ringColorClass: "ring-[#7B6FD8]",
    borderIdleClass: "border-[#7B6FD8] hover:bg-[#ECE8FA]",
  },
  {
    id: "mal",
    emoji: "😟",
    label: "Mal",
    solidBgClass: "bg-[#B8860B] border-[#B8860B]",
    selectedTextClass: "text-white",
    ringColorClass: "ring-[#B8860B]",
    borderIdleClass: "border-[#B8860B] hover:bg-[#F5F1E8]",
  },
  {
    id: "muy-mal",
    emoji: "😢",
    label: "Muy mal",
    solidBgClass: "bg-[#C8102E] border-[#C8102E]",
    selectedTextClass: "text-white",
    ringColorClass: "ring-[#C8102E]",
    borderIdleClass: "border-[#C8102E] hover:bg-[#FEE2E2]",
  },
];

interface DailyMoodWidgetProps {
  userKey?: string | null;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DailyMoodWidget({ userKey }: DailyMoodWidgetProps) {
  const storageKey = `equilibra_chat_mood_${(userKey || "guest").replace(/[^a-zA-Z0-9_-]/g, "_")}_${getTodayDateString()}`;
  const [selectedMood, setSelectedMood] = useState<DailyMoodKey | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) as DailyMoodKey | null;
      if (saved && MOOD_OPTIONS.some((opt) => opt.id === saved)) {
        setSelectedMood(saved);
      } else {
        setSelectedMood(null);
      }
    } catch {
      setSelectedMood(null);
    }
  }, [storageKey]);

  const handleSelectMood = (option: MoodOption) => {
    setSelectedMood(option.id);
    try {
      localStorage.setItem(storageKey, option.id);
    } catch {
      // ignore storage errors
    }
    toast.success(`Estado de ánimo registrado: ${option.label}`);
  };

  const activeOption = MOOD_OPTIONS.find((opt) => opt.id === selectedMood);

  return (
    <section
      aria-labelledby="daily-mood-title"
      className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
    >
      <div className="space-y-1">
        <h2 id="daily-mood-title" className="text-sm font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
          ¿Cómo te sientes hoy?
        </h2>
        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
          Registra tu estado emocional actual en un toque.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Emocionómetro">
        {MOOD_OPTIONS.map((option) => {
          const isSelected = selectedMood === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={option.label}
              onClick={() => handleSelectMood(option)}
              className="group flex cursor-pointer flex-col items-center gap-1.5 focus-visible:outline-none"
            >
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-full border-2 text-xl transition-all duration-150",
                  isSelected
                    ? cn(
                        option.solidBgClass,
                        option.selectedTextClass,
                        "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1A2618]",
                        option.ringColorClass,
                      )
                    : cn(
                        "bg-white text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]",
                        option.borderIdleClass,
                      ),
                )}
              >
                <span aria-hidden="true">{option.emoji}</span>
              </span>
              <span
                className={cn(
                  "text-center text-[11px] leading-tight transition-colors",
                  isSelected
                    ? "font-bold text-[#1A1A1A] dark:text-[#F5F1E8]"
                    : "font-medium text-[#6B6B6B] group-hover:text-[#1A1A1A] dark:text-[#A6B5A3] dark:group-hover:text-[#F5F1E8]",
                )}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {activeOption && (
        <p className="mt-3.5 border-t border-[#E5DFD3] pt-3 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
          Registro de hoy:{" "}
          <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
            {activeOption.label}
          </span>
        </p>
      )}
    </section>
  );
}
