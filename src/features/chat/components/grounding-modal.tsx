import { useState } from "react";
import { CheckCircle2, Hand, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GroundingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GROUNDING_STEPS = [
  {
    count: 5,
    sense: "Vista",
    prompt: "Observa a tu alrededor e identifica 5 objetos concretos.",
    example: "Por ejemplo: una ventana, un cuaderno, la luz de la lámpara.",
  },
  {
    count: 4,
    sense: "Tacto",
    prompt: "Percibe 4 sensaciones físicas en contacto con tu cuerpo.",
    example: "Por ejemplo: tus pies en el suelo, la textura de tu ropa o la silla.",
  },
  {
    count: 3,
    sense: "Oído",
    prompt: "Presta atención e identifica 3 sonidos distintos en tu entorno.",
    example: "Por ejemplo: el aire acondicionado, pasos lejanos o tu propia respiración.",
  },
  {
    count: 2,
    sense: "Olfato",
    prompt: "Reconoce 2 aromas presentes cerca de ti.",
    example: "Por ejemplo: aire fresco, café, papel o jabón.",
  },
  {
    count: 1,
    sense: "Gusto",
    prompt: "Nota 1 sensación en tu boca o toma un sorbo de agua con calma.",
    example: "Respira profundo al terminar y siente tu presencia en el momento actual.",
  },
] as const;

export function GroundingModal({ isOpen, onClose }: GroundingModalProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (count: number) => {
    setCompletedSteps((prev) =>
      prev.includes(count) ? prev.filter((item) => item !== count) : [...prev, count],
    );
  };

  const handleReset = () => {
    setCompletedSteps([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-lg border border-[#E5DFD3] bg-white p-6 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#E0F0E8] text-[#1F4D2C]">
              <Hand className="size-5" strokeWidth={1.75} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                Anclaje sensorial 5-4-3-2-1
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                Técnica clínica de regulación para regresar al presente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-2.5">
          {GROUNDING_STEPS.map((step) => {
            const isDone = completedSteps.includes(step.count);
            return (
              <button
                key={step.count}
                type="button"
                onClick={() => toggleStep(step.count)}
                className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isDone
                    ? "border-[#8FC9B5] bg-[#E0F0E8]/70 dark:border-[#4A7C59] dark:bg-[#0F1A12]"
                    : "border-[#E5DFD3] bg-[#F5F1E8]/40 hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    isDone ? "bg-[#1F4D2C] text-white" : "bg-[#8FC9B5] text-[#1A1A1A]"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="size-4" strokeWidth={2} /> : step.count}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    {step.sense}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {step.prompt}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                    {step.example}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E5DFD3] pt-4 dark:border-[#2D3F2A]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-9 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            <span>Reiniciar pasos</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="h-9 cursor-pointer rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
          >
            Continuar tamizaje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
