import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  MessageCircleHeart,
  Settings,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { triggerRedAlert } from "@/lib/api-client";
import { recordCheckInSuccess } from "@/lib/streak-store";
import {
  fetchRecentCheckInHistory,
  getLocalCheckInHistory,
  submitEmotionalCheckIn,
  type CheckInEmotionId,
  type CheckInHistoryEntry,
} from "./checkin-history";

interface EmotionOption {
  id: CheckInEmotionId;
  emoji: string;
  label: string;
  hoverClass: string;
  selectedClass: string;
  dotColor: string;
}

const EMOTION_OPTIONS: EmotionOption[] = [
  {
    id: "bien",
    emoji: "😊",
    label: "Bien",
    hoverClass: "hover:bg-[#F5C7A8]/55 hover:border-[#F5C7A8]",
    selectedClass: "bg-[#F5C7A8] border-[#F5C7A8] text-[#1A1A1A]",
    dotColor: "#F5C7A8",
  },
  {
    id: "regular",
    emoji: "🙂",
    label: "Regular",
    hoverClass: "hover:bg-[#8FC9B5]/55 hover:border-[#8FC9B5]",
    selectedClass: "bg-[#8FC9B5] border-[#8FC9B5] text-[#1A1A1A]",
    dotColor: "#8FC9B5",
  },
  {
    id: "neutral",
    emoji: "😐",
    label: "Neutral",
    hoverClass: "hover:bg-[#7B6FD8]/20 hover:border-[#7B6FD8]",
    selectedClass: "bg-[#7B6FD8] border-[#7B6FD8] text-white",
    dotColor: "#7B6FD8",
  },
  {
    id: "mal",
    emoji: "😟",
    label: "Mal",
    hoverClass: "hover:bg-[#B8860B]/20 hover:border-[#B8860B]",
    selectedClass: "bg-[#B8860B] border-[#B8860B] text-white",
    dotColor: "#B8860B",
  },
  {
    id: "muy-mal",
    emoji: "😢",
    label: "Muy mal",
    hoverClass: "hover:bg-[#C8102E]/15 hover:border-[#C8102E]",
    selectedClass: "bg-[#C8102E] border-[#C8102E] text-white",
    dotColor: "#C8102E",
  },
];

const MAX_NOTE_LENGTH = 280;

function formatShortDate(isoDate: string): string {
  try {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return "Hoy";
    return parsed.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "Hoy";
  }
}

function formatDateTime(isoDate: string): string {
  try {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return "Reciente";
    return parsed.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Reciente";
  }
}

export function CheckInPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedEmotion, setSelectedEmotion] = useState<CheckInEmotionId | null>(null);
  const [intensity, setIntensity] = useState<number>(5);
  const [note, setNote] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const [lastSavedState, setLastSavedState] = useState<{
    emotionId: CheckInEmotionId;
    intensity: number;
  } | null>(null);

  const [history, setHistory] = useState<CheckInHistoryEntry[]>(() =>
    getLocalCheckInHistory(user?.id),
  );
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      const entries = await fetchRecentCheckInHistory(user?.id);
      if (active) {
        setHistory(entries);
      }
    }
    loadHistory();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const selectedOption = useMemo(
    () => EMOTION_OPTIONS.find((opt) => opt.id === selectedEmotion) || null,
    [selectedEmotion],
  );

  const chartData = useMemo(() => {
    return [...history]
      .slice(0, 7)
      .reverse()
      .map((entry, idx) => ({
        index: idx + 1,
        fecha: formatShortDate(entry.createdAt),
        intensidad: entry.intensity,
        emocion: entry.emotionLabel,
      }));
  }, [history]);

  const showEliBanner = Boolean(
    lastSavedState && (lastSavedState.emotionId === "muy-mal" || lastSavedState.intensity >= 8),
  );
  const showDangerBanner = Boolean(
    lastSavedState && lastSavedState.emotionId === "muy-mal" && lastSavedState.intensity === 10,
  );

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    { label: "Bienestar Estudiantil", href: "/" },
    { label: "¿Cómo estás hoy?" },
  ];

  const handleSaveCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption) {
      setValidationError("Selecciona cómo te sientes ahora mismo para guardar tu check-in.");
      return;
    }

    setValidationError("");
    setIsSaving(true);

    try {
      const savedEntry = await submitEmotionalCheckIn({
        emotionId: selectedOption.id,
        emotionLabel: selectedOption.label,
        intensity,
        note,
        userId: user?.id,
      });

      recordCheckInSuccess();

      if (selectedOption.id === "muy-mal" && intensity === 10) {
        void triggerRedAlert(savedEntry.id, user?.id);
      }

      setHistory((prev) =>
        [savedEntry, ...prev.filter((item) => item.id !== savedEntry.id)].slice(0, 7),
      );
      setLastSavedState({
        emotionId: selectedOption.id,
        intensity,
      });

      toast.success("Check-in guardado", {
        description: `${selectedOption.label} · Intensidad ${intensity}/10`,
        style: {
          backgroundColor: "#E0F0E8",
          borderColor: "#8FC9B5",
          color: "#1F4D2C",
        },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos guardar tu check-in. Intenta de nuevo en un momento.";
      setValidationError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] font-sans text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <InstitutionalHeader
        moduleTitle="¿Cómo estás hoy?"
        breadcrumbs={breadcrumbs}
        onHomeClick={() => navigate({ to: "/" })}
        showCrisisButton={true}
        onCrisisClick={() => navigate({ to: "/alerta" })}
        actions={
          <>
            <AjustesModal
              rol={user?.role || "estudiante"}
              trigger={
                <button
                  type="button"
                  aria-label="Abrir configuración y ajustes"
                  title="Configuración y ajustes"
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Settings className="size-[18px]" strokeWidth={1.75} />
                </button>
              }
            />
            <ThemeToggle className="size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none backdrop-blur-none hover:scale-100 hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white" />
          </>
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid items-start justify-center gap-6 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]">
          {/* Card central max-w-xl */}
          <section
            aria-labelledby="checkin-step-1-heading"
            className="mx-auto w-full max-w-xl rounded-lg border border-[#E5DFD3] bg-white p-6 sm:p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
          >
            <form onSubmit={handleSaveCheckIn} className="space-y-8">
              <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Check-in emocional rápido
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                  ¿Cómo estás hoy?
                </h2>
                <p className="mt-1 text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Tómate un minuto para registrar tu estado emocional de forma confidencial.
                </p>
              </div>

              {/* PASO 1 — EMOCIÓN PRINCIPAL */}
              <fieldset className="space-y-3">
                <legend
                  id="checkin-step-1-heading"
                  className="text-base font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                >
                  1. ¿Cómo te sientes ahora mismo?
                </legend>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {EMOTION_OPTIONS.map((option) => {
                    const isSelected = selectedEmotion === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedEmotion(option.id);
                          setValidationError("");
                        }}
                        className={`flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border px-2 py-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] focus-visible:ring-offset-2 ${
                          isSelected
                            ? `${option.selectedClass} ring-2 ring-[#1F4D2C] ring-offset-2 ring-offset-white dark:ring-offset-[#1A2618]`
                            : `border-[#E5DFD3] bg-[#F5F1E8]/40 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] ${option.hoverClass}`
                        }`}
                      >
                        <span aria-hidden="true" className="text-[48px] leading-none select-none">
                          {option.emoji}
                        </span>
                        <span className="text-sm font-semibold">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* PASO 2 — INTENSIDAD */}
              <div className="space-y-3 border-t border-[#E5DFD3] pt-6 dark:border-[#2D3F2A]">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="checkin-intensity-slider"
                    className="text-base font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                  >
                    2. Intensidad
                  </label>
                  <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 py-0.5 text-sm font-bold tabular-nums text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    {intensity} / 10
                  </span>
                </div>

                <SliderPrimitive.Root
                  id="checkin-intensity-slider"
                  aria-label="Intensidad emocional del 1 al 10"
                  min={1}
                  max={10}
                  step={1}
                  value={[intensity]}
                  onValueChange={(vals) => {
                    if (typeof vals[0] === "number") {
                      setIntensity(vals[0]);
                    }
                  }}
                  className="relative flex h-7 w-full touch-none select-none items-center"
                >
                  <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
                    <SliderPrimitive.Range className="absolute h-full bg-[#1F4D2C]" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb className="block size-5 cursor-grab rounded-full border-2 border-white bg-[#1F4D2C] shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] focus-visible:ring-offset-2 active:cursor-grabbing" />
                </SliderPrimitive.Root>

                <div className="flex items-center justify-between text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                  <span>1 = Nada</span>
                  <span>10 = Muchísimo</span>
                </div>
              </div>

              {/* PASO 3 — NOTA OPCIONAL */}
              <div className="space-y-2 border-t border-[#E5DFD3] pt-6 dark:border-[#2D3F2A]">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="checkin-optional-note"
                    className="text-base font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                  >
                    3. ¿Quieres agregar algo?
                  </label>
                  <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Opcional
                  </span>
                </div>

                <Textarea
                  id="checkin-optional-note"
                  rows={3}
                  maxLength={MAX_NOTE_LENGTH}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Puedes escribir brevemente qué influyó en cómo te sientes hoy..."
                  className="resize-none border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                />

                <div className="flex justify-end">
                  <span className="text-xs font-medium tabular-nums text-[#6B6B6B] dark:text-[#A6B5A3]">
                    {note.length} / {MAX_NOTE_LENGTH} caracteres
                  </span>
                </div>
              </div>

              {validationError && (
                <p
                  role="alert"
                  className="rounded-lg border border-[#C8102E]/40 bg-[#FEE2E2] px-4 py-3 text-sm font-medium text-[#C8102E]"
                >
                  {validationError}
                </p>
              )}

              {/* PASO 4 — CONFIRMACIÓN */}
              <div className="space-y-4 border-t border-[#E5DFD3] pt-6 dark:border-[#2D3F2A]">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="h-11 w-full cursor-pointer rounded-lg bg-[#1F4D2C] text-sm font-semibold text-white transition-colors hover:bg-[#4A7C59] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Guardando check-in..." : "Guardar check-in"}
                </Button>

                {lastSavedState && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#8FC9B5] bg-[#E0F0E8] px-4 py-3 text-sm font-medium text-[#1F4D2C]">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      Tu check-in fue registrado correctamente. Gracias por tomar este momento para
                      ti.
                    </span>
                  </div>
                )}

                {/* Banner danger: emoción = "Muy mal" + intensidad = 10 */}
                {showDangerBanner && (
                  <div
                    role="alert"
                    className="space-y-3 rounded-lg border-2 border-[#C8102E] bg-[#FEE2E2] p-4 text-[#1A1A1A]"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#C8102E]" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-[#C8102E]">
                          ¿Necesitas apoyo inmediato en este momento?
                        </p>
                        <p className="text-xs leading-relaxed text-[#1A1A1A]">
                          No tienes que atravesar esto a solas. Hay líneas de atención y apoyo
                          inmediato disponibles 24/7.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => navigate({ to: "/alerta" })}
                      className="h-10 w-full cursor-pointer rounded-lg bg-[#C8102E] text-xs font-bold text-white hover:bg-[#9B0C24]"
                    >
                      Ver líneas de ayuda inmediata
                    </Button>
                  </div>
                )}

                {/* Banner sutil: emoción = "Muy mal" o intensidad >= 8 */}
                {showEliBanner && (
                  <div className="flex flex-col justify-between gap-3 rounded-lg border border-[#7B6FD8]/40 bg-[#ECE8FA] p-4 sm:flex-row sm:items-center dark:bg-[#231F3A]">
                    <div className="flex items-start gap-3">
                      <MessageCircleHeart className="mt-0.5 size-5 shrink-0 text-[#7B6FD8]" />
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          ¿Quieres hablar con Eli?
                        </p>
                        <p className="text-xs text-[#6B6B6B] dark:text-[#E5DFD3]">
                          Puedes conversar de forma confidencial o realizar un tamizaje breve.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => navigate({ to: "/chat" })}
                      className="h-9 shrink-0 cursor-pointer rounded-lg bg-[#7B6FD8] px-4 text-xs font-semibold text-white hover:bg-[#695CC8]"
                    >
                      Hablar con Eli
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </section>

          {/* HISTORIAL SIDEBAR: Gráfica Recharts + últimos 7 check-ins */}
          <aside
            aria-label="Historial de los últimos 7 check-ins"
            className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#E5DFD3] pb-3.5 dark:border-[#2D3F2A]">
              <div className="flex items-center gap-2">
                <History className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Historial reciente
                </h2>
              </div>
              <span className="text-xs font-medium tabular-nums text-[#6B6B6B] dark:text-[#A6B5A3]">
                Últimos 7 registros
              </span>
            </div>

            {/* Mini gráfica de tendencia Recharts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                <span className="inline-flex items-center gap-1.5">
                  <TrendingUp className="size-3.5 text-[#7B6FD8]" />
                  Tendencia de intensidad
                </span>
                <span className="tabular-nums">Escala 1–10</span>
              </div>

              <div className="h-44 w-full rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/35 p-2 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                {isClient && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 10, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD3" />
                      <XAxis
                        dataKey="fecha"
                        tick={{ fontSize: 11, fill: "#6B6B6B" }}
                        axisLine={{ stroke: "#E5DFD3" }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[1, 10]}
                        ticks={[1, 5, 10]}
                        tick={{ fontSize: 11, fill: "#6B6B6B" }}
                        axisLine={{ stroke: "#E5DFD3" }}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E5DFD3",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#1A1A1A",
                        }}
                        formatter={(value: number) => [`${value}/10`, "Intensidad"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="intensidad"
                        stroke="#7B6FD8"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#7B6FD8", strokeWidth: 2, stroke: "#FFFFFF" }}
                        activeDot={{ r: 6, fill: "#7B6FD8" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center px-4 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Guarda tu primer check-in para visualizar tu gráfica de intensidad.
                  </div>
                )}
              </div>
            </div>

            {/* Lista de los últimos 7 check-ins */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                Últimos check-ins
              </h3>

              {history.length > 0 ? (
                <ul className="divide-y divide-[#E5DFD3] rounded-lg border border-[#E5DFD3] dark:divide-[#2D3F2A] dark:border-[#2D3F2A]">
                  {history.slice(0, 7).map((entry) => {
                    const meta =
                      EMOTION_OPTIONS.find((opt) => opt.id === entry.emotionId) ||
                      EMOTION_OPTIONS[2];
                    return (
                      <li key={entry.id} className="space-y-1 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="text-lg leading-none">
                              {meta.emoji}
                            </span>
                            <span className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                              {entry.emotionLabel}
                            </span>
                          </div>
                          <span className="text-xs font-bold tabular-nums text-[#7B6FD8]">
                            {entry.intensity}/10
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          <span>{formatDateTime(entry.createdAt)}</span>
                        </div>

                        {entry.note && (
                          <p className="pt-1 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#E5DFD3]">
                            “{entry.note}”
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-lg border border-dashed border-[#E5DFD3] p-5 text-center text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                  Aún no hay registros recientes en tu historial.
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
