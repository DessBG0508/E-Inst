import { Link } from "@tanstack/react-router";
import { ArrowRight, Hand, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuickExercisesCardProps {
  onOpenBreathing: () => void;
  onOpenGrounding: () => void;
}

export function QuickExercisesCard({ onOpenBreathing, onOpenGrounding }: QuickExercisesCardProps) {
  return (
    <section
      aria-labelledby="quick-exercises-title"
      className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
    >
      <div className="space-y-1">
        <h2
          id="quick-exercises-title"
          className="text-sm font-bold text-[#1F4D2C] dark:text-[#8FC9B5]"
        >
          Ejercicios rápidos
        </h2>
        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
          Pausas breves de regulación antes o durante tu cuestionario.
        </p>
      </div>

      <div className="mt-4 space-y-2.5">
        <Button
          type="button"
          onClick={onOpenBreathing}
          className="h-11 w-full cursor-pointer justify-start gap-2.5 rounded-lg bg-[#7B6FD8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6A5FC9] focus-visible:ring-2 focus-visible:ring-[#7B6FD8]"
        >
          <Wind className="size-4 shrink-0" strokeWidth={1.75} />
          <span>Respiración 4-7-8</span>
        </Button>

        <Button
          type="button"
          onClick={onOpenGrounding}
          className="h-11 w-full cursor-pointer justify-start gap-2.5 rounded-lg bg-[#8FC9B5] px-4 text-sm font-semibold text-[#1A1A1A] transition-colors hover:bg-[#7AB5A1] focus-visible:ring-2 focus-visible:ring-[#8FC9B5]"
        >
          <Hand className="size-4 shrink-0" strokeWidth={1.75} />
          <span>Grounding 5-4-3-2-1</span>
        </Button>
      </div>

      <div className="mt-4 border-t border-[#E5DFD3] pt-3 dark:border-[#2D3F2A]">
        <Link
          to="/checkin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F4D2C] underline underline-offset-4 transition-colors hover:text-[#4A7C59] dark:text-[#8FC9B5]"
        >
          <span>Ir a check-in emocional</span>
          <ArrowRight className="size-3.5" strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
