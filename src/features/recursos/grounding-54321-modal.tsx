import { useEffect, useState } from "react";
import { CheckCircle2, Hand, RotateCcw, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface Grounding54321ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GroundingStep {
  id: "ves" | "tocas" | "escuchas" | "hueles" | "saboreas";
  count: number;
  title: string;
  sense: string;
  placeholder: string;
}

const GROUNDING_STEPS: GroundingStep[] = [
  {
    id: "ves",
    count: 5,
    title: "5 cosas que ves",
    sense: "Vista",
    placeholder: "Ej. mi cuaderno, la ventana, una lámpara, mi lápiz, el árbol...",
  },
  {
    id: "tocas",
    count: 4,
    title: "4 cosas que tocas",
    sense: "Tacto",
    placeholder: "Ej. mis pies en el piso, la tela del suéter, el escritorio, mi taza...",
  },
  {
    id: "escuchas",
    count: 3,
    title: "3 cosas que escuchas",
    sense: "Oído",
    placeholder: "Ej. el viento afuera, pasos lejanos, mi propia respiración...",
  },
  {
    id: "hueles",
    count: 2,
    title: "2 cosas que hueles",
    sense: "Olfato",
    placeholder: "Ej. aire fresco, café o papel limpio...",
  },
  {
    id: "saboreas",
    count: 1,
    title: "1 cosa que saboreas",
    sense: "Gusto",
    placeholder: "Ej. agua fresca, menta o sensación neutra en la boca...",
  },
];

type GroundingAnswers = Record<GroundingStep["id"], string>;

const INITIAL_ANSWERS: GroundingAnswers = {
  ves: "",
  tocas: "",
  escuchas: "",
  hueles: "",
  saboreas: "",
};

export function Grounding54321Modal({ isOpen, onClose }: Grounding54321ModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [answers, setAnswers] = useState<GroundingAnswers>(INITIAL_ANSWERS);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsCompleted(false);
    }
  }, [isOpen]);

  const completedCount = GROUNDING_STEPS.filter(
    (step) => answers[step.id].trim().length > 0,
  ).length;
  const allStepsFilled = completedCount === GROUNDING_STEPS.length;

  const handleChange = (id: GroundingStep["id"], value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allStepsFilled) return;
    setIsCompleted(true);
  };

  const handleReset = () => {
    setAnswers(INITIAL_ANSWERS);
    setIsCompleted(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-xl border border-[#E5DFD3] bg-white p-6 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ECE8FA] text-[#7B6FD8]">
                <Hand className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Grounding 5-4-3-2-1
                </DialogTitle>
                <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Escribe lo que percibes en tu entorno para volver al momento presente.
                </DialogDescription>
              </div>
            </div>

            {!isCompleted && (
              <span className="shrink-0 rounded-full bg-[#ECE8FA] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#7B6FD8]">
                {completedCount}/5 pasos
              </span>
            )}
          </div>
        </DialogHeader>

        {isCompleted ? (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 space-y-5"
          >
            <div className="rounded-xl border-2 border-[#7B6FD8] bg-[#ECE8FA] p-6 text-center dark:bg-[#7B6FD8]/15">
              <motion.div
                initial={shouldReduceMotion ? {} : { scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-[#7B6FD8] text-white shadow-sm"
              >
                <Sparkles className="size-7" strokeWidth={1.75} />
              </motion.div>

              <h3 className="text-xl font-bold text-[#7B6FD8] dark:text-[#B9B0F3]">
                ¡Anclaje 5-4-3-2-1 completado!
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                Acabas de conectar con tus cinco sentidos y traer tu atención de vuelta al aquí y
                ahora. Tómate una respiración profunda y nota cómo se siente tu cuerpo en este
                momento.
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                Tu registro sensorial
              </p>
              <ul className="space-y-1.5 text-xs">
                {GROUNDING_STEPS.map((step) => (
                  <li key={step.id} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#7B6FD8]" />
                    <span>
                      <strong className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        {step.title}:
                      </strong>{" "}
                      <span className="text-[#1A1A1A] dark:text-[#F5F1E8]">{answers[step.id]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DFD3] pt-4 dark:border-[#2D3F2A]">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="h-10 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
              >
                <RotateCcw className="size-3.5" />
                <span>Hacer otra ronda</span>
              </Button>

              <Button
                type="button"
                onClick={onClose}
                className="h-10 cursor-pointer rounded-lg bg-[#7B6FD8] px-5 text-xs font-semibold text-white hover:bg-[#695CC8]"
              >
                Volver a recursos
              </Button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleComplete} className="mt-2 space-y-3">
            {GROUNDING_STEPS.map((step) => {
              const filled = answers[step.id].trim().length > 0;
              return (
                <div
                  key={step.id}
                  className={`rounded-lg border p-3.5 transition-colors ${
                    filled
                      ? "border-[#7B6FD8]/60 bg-[#ECE8FA]/45 dark:border-[#7B6FD8]/50 dark:bg-[#7B6FD8]/10"
                      : "border-[#E5DFD3] bg-[#F5F1E8]/40 dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      htmlFor={`grounding-${step.id}`}
                      className="flex items-center gap-2.5 text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                          filled
                            ? "bg-[#7B6FD8] text-white"
                            : "bg-[#E5DFD3] text-[#1A1A1A] dark:bg-[#2D3F2A] dark:text-[#F5F1E8]"
                        }`}
                      >
                        {filled ? <CheckCircle2 className="size-3.5" /> : step.count}
                      </span>
                      <span>{step.title}</span>
                    </label>
                    <span className="text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      {step.sense}
                    </span>
                  </div>

                  <Input
                    id={`grounding-${step.id}`}
                    type="text"
                    value={answers[step.id]}
                    onChange={(e) => handleChange(step.id, e.target.value)}
                    placeholder={step.placeholder}
                    className="h-10 border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus-visible:ring-[#7B6FD8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                  />
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-2 border-t border-[#E5DFD3] pt-4 dark:border-[#2D3F2A]">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="h-10 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
              >
                <RotateCcw className="size-3.5" />
                <span>Limpiar</span>
              </Button>

              <Button
                type="submit"
                disabled={!allStepsFilled}
                className="h-10 cursor-pointer rounded-lg bg-[#7B6FD8] px-5 text-xs font-semibold text-white hover:bg-[#695CC8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Completar ejercicio
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
