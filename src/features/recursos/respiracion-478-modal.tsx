import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Wind, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

export interface Respiracion478ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type BreathingPhase = "inhala" | "reten" | "exhala";

const PHASE_CONFIG: Record<
  BreathingPhase,
  {
    title: string;
    subtitle: string;
    durationSec: number;
    durationMs: number;
    targetScale: number;
    ringColor: string;
    badgeBg: string;
  }
> = {
  inhala: {
    title: "Inhala",
    subtitle: "Toma aire suavemente por la nariz",
    durationSec: 4,
    durationMs: 4000,
    targetScale: 1.18,
    ringColor: "border-[#1F4D2C]/40 bg-[#8FC9B5]/45",
    badgeBg: "bg-[#1F4D2C] text-white",
  },
  reten: {
    title: "Retén",
    subtitle: "Mantén el aire con serenidad, sin tensión",
    durationSec: 7,
    durationMs: 700,
    targetScale: 1.18,
    ringColor: "border-[#7B6FD8]/45 bg-[#ECE8FA]/80",
    badgeBg: "bg-[#7B6FD8] text-white",
  },
  exhala: {
    title: "Exhala",
    subtitle: "Suelta el aire despacio por la boca",
    durationSec: 8,
    durationMs: 8000,
    targetScale: 0.78,
    ringColor: "border-[#4A7C59]/40 bg-white/80",
    badgeBg: "bg-[#4A7C59] text-white",
  },
};

export function Respiracion478Modal({ isOpen, onClose }: Respiracion478ModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isActive, setIsActive] = useState(true);
  const [phase, setPhase] = useState<BreathingPhase>("inhala");
  const [countdown, setCountdown] = useState(4);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [orbScale, setOrbScale] = useState(0.78);

  useEffect(() => {
    if (!isOpen) {
      setIsActive(false);
      return;
    }

    setIsActive(true);
    setPhase("inhala");
    setCountdown(4);
    setCyclesCompleted(0);
    setOrbScale(0.78);

    const frame = requestAnimationFrame(() => {
      setOrbScale(PHASE_CONFIG.inhala.targetScale);
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isActive) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev > 1) return prev - 1;

        if (phase === "inhala") {
          setPhase("reten");
          setOrbScale(PHASE_CONFIG.reten.targetScale);
          return PHASE_CONFIG.reten.durationSec;
        }

        if (phase === "reten") {
          setPhase("exhala");
          setOrbScale(PHASE_CONFIG.exhala.targetScale);
          return PHASE_CONFIG.exhala.durationSec;
        }

        setPhase("inhala");
        setCyclesCompleted((c) => c + 1);
        setOrbScale(PHASE_CONFIG.inhala.targetScale);
        return PHASE_CONFIG.inhala.durationSec;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, isActive, phase]);

  if (!isOpen) return null;

  const current = PHASE_CONFIG[phase];

  const handleRestart = () => {
    setPhase("inhala");
    setCountdown(4);
    setCyclesCompleted(0);
    setIsActive(true);
    setOrbScale(0.78);
    requestAnimationFrame(() => {
      setOrbScale(PHASE_CONFIG.inhala.targetScale);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="respiracion-478-title"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-[#E0F0E8] px-4 py-6 text-[#1A1A1A] sm:px-8 sm:py-8 dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
    >
      {/* Barra superior con botón sutil Cerrar */}
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-white/80 text-[#1F4D2C] shadow-2xs dark:bg-[#1A2618] dark:text-[#8FC9B5]">
            <Wind className="size-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2
              id="respiracion-478-title"
              className="text-base font-bold tracking-tight text-[#1F4D2C] sm:text-lg dark:text-[#8FC9B5]"
            >
              Respiración 4-7-8
            </h2>
            <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Inhala 4s · Retén 7s · Exhala 8s
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          className="h-10 cursor-pointer gap-1.5 rounded-lg px-3 text-sm font-medium text-[#1F4D2C] hover:bg-[#1F4D2C]/10 dark:text-[#F5F1E8] dark:hover:bg-white/10"
        >
          <X className="size-4" strokeWidth={1.75} />
          <span>Cerrar</span>
        </Button>
      </div>

      {/* Centro: Círculo animado grande con texto centrado */}
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center py-6 text-center">
        <div className="relative flex size-64 items-center justify-center sm:size-80">
          {/* Halo exterior suave */}
          <div
            aria-hidden="true"
            style={{
              transform: shouldReduceMotion ? "scale(1)" : `scale(${orbScale})`,
              transitionProperty: "transform, background-color, border-color",
              transitionDuration: shouldReduceMotion ? "200ms" : `${current.durationMs}ms`,
              transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            className={`absolute inset-4 rounded-full border-2 shadow-sm ${current.ringColor}`}
          />

          {/* Círculo interior con texto grande centrado */}
          <div
            style={{
              transform: shouldReduceMotion ? "scale(1)" : `scale(${orbScale * 0.92})`,
              transitionProperty: "transform",
              transitionDuration: shouldReduceMotion ? "200ms" : `${current.durationMs}ms`,
              transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            className="relative z-10 flex size-44 flex-col items-center justify-center rounded-full border border-[#E5DFD3] bg-white/95 shadow-md sm:size-52 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
          >
            <span className="text-3xl font-bold tracking-tight text-[#1F4D2C] sm:text-4xl dark:text-[#8FC9B5]">
              {current.title}
            </span>
            <span className="mt-1 text-4xl font-bold tabular-nums text-[#1A1A1A] sm:text-5xl dark:text-[#F5F1E8]">
              {countdown}
            </span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
              segundos
            </span>
          </div>
        </div>

        <p className="mt-4 min-h-7 text-base font-medium text-[#1A1A1A] sm:text-lg dark:text-[#F5F1E8]">
          {current.subtitle}
        </p>

        {/* Indicador de fases 4-7-8 */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {(["inhala", "reten", "exhala"] as const).map((step) => {
            const cfg = PHASE_CONFIG[step];
            const active = phase === step;
            return (
              <span
                key={step}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  active
                    ? cfg.badgeBg
                    : "border border-[#E5DFD3] bg-white/70 text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A6B5A3]"
                }`}
              >
                {cfg.title} ({cfg.durationSec}s)
              </span>
            );
          })}
        </div>
      </div>

      {/* Pie: Contador de ciclos + controles */}
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 border-t border-[#1F4D2C]/15 pt-5 dark:border-[#2D3F2A]">
        <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5DFD3] bg-white/85 px-4 py-2 text-sm font-medium text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
          <span className="text-[#6B6B6B] dark:text-[#A6B5A3]">Ciclos completados:</span>
          <span className="text-lg font-bold tabular-nums text-[#1F4D2C] dark:text-[#8FC9B5]">
            {cyclesCompleted}
          </span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsActive((prev) => !prev)}
            className="h-10 cursor-pointer gap-2 rounded-lg border-[#E5DFD3] bg-white px-4 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
          >
            {isActive ? (
              <>
                <Pause className="size-4" />
                <span>Pausar</span>
              </>
            ) : (
              <>
                <Play className="size-4" />
                <span>Reanudar</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleRestart}
            className="h-10 cursor-pointer gap-2 rounded-lg border-[#E5DFD3] bg-white px-4 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
          >
            <RotateCcw className="size-4" />
            <span>Reiniciar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
