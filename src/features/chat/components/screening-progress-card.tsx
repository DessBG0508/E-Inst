import { Copy, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScreeningNivel, ScreeningState } from "@/lib/eli-screening";

interface ScreeningProgressCardProps {
  screeningState: ScreeningState;
  storedFolio?: string | null;
}

const STEP_LABELS: Record<ScreeningState["step"], string> = {
  not_started: "Por iniciar",
  waiting_consent: "Consentimiento informado",
  declined: "Tamizaje declinado",
  waiting_initials: "Datos de identificación",
  waiting_age: "Datos de identificación",
  waiting_sex: "Datos de identificación",
  waiting_fecha: "Fecha de aplicación",
  gad7: "Cuestionario GAD-7 (Ansiedad)",
  phq9: "Cuestionario PHQ-9 (Estado de ánimo)",
  completed: "Tamizaje finalizado",
};

const SEMAFORO_META: Record<
  ScreeningNivel,
  {
    label: string;
    detail: string;
    containerClass: string;
    badgeClass: string;
  }
> = {
  verde: {
    label: "Semáforo Verde",
    detail: "Sin alerta clínica grave",
    containerClass: "border-[#1F4D2C]/25 bg-[#E0F0E8]/70 dark:border-[#2D3F2A] dark:bg-[#14291A]",
    badgeClass: "bg-[#1F4D2C] text-white",
  },
  amarillo: {
    label: "Semáforo Amarillo",
    detail: "Seguimiento recomendado",
    containerClass:
      "border-[#B8860B]/35 bg-[#FEF3C7]/80 dark:border-[#B8860B]/40 dark:bg-[#2A220E]",
    badgeClass: "bg-[#B8860B] text-white",
  },
  rojo: {
    label: "Semáforo Rojo",
    detail: "Atención prioritaria",
    containerClass:
      "border-[#C8102E]/35 bg-[#FEE2E2]/80 dark:border-[#C8102E]/40 dark:bg-[#2B1216]",
    badgeClass: "bg-[#C8102E] text-white",
  },
};

export function ScreeningProgressCard({ screeningState, storedFolio }: ScreeningProgressCardProps) {
  const gad7Completed = Math.min(7, screeningState.gad7Items?.length || 0);
  const phq9Completed = Math.min(9, screeningState.phq9Items?.length || 0);
  const gad7Percent = Math.round((gad7Completed / 7) * 100);
  const phq9Percent = Math.round((phq9Completed / 9) * 100);

  const activeFolio = screeningState.folio || storedFolio || null;
  const activeNivel = screeningState.nivel;
  const semaforo = activeNivel ? SEMAFORO_META[activeNivel] : null;
  const gad7Total = (screeningState.gad7Items || []).reduce((acc, v) => acc + v, 0);
  const phq9Total = (screeningState.phq9Items || []).reduce((acc, v) => acc + v, 0);

  const handleCopyFolio = () => {
    if (!activeFolio) return;
    navigator.clipboard.writeText(activeFolio);
    toast.success(`Folio ${activeFolio} copiado al portapapeles.`);
  };

  return (
    <section
      aria-labelledby="screening-progress-title"
      className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="screening-progress-title"
            className="text-sm font-bold text-[#1F4D2C] dark:text-[#8FC9B5]"
          >
            Tu progreso en el tamizaje
          </h2>
          <p className="mt-0.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
            {STEP_LABELS[screeningState.step]}
          </p>
        </div>

        {activeFolio ? (
          <Badge className="shrink-0 rounded-md border-0 bg-[#B8860B] px-2.5 py-1 font-mono text-xs font-bold text-white tabular-nums">
            {activeFolio}
          </Badge>
        ) : (
          <span className="shrink-0 text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            Folio pendiente
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {/* GAD-7 Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
              GAD-7 (Ansiedad)
            </span>
            <span className="font-mono font-semibold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
              {gad7Completed}/7
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso en cuestionario GAD-7"
            aria-valuenow={gad7Completed}
            aria-valuemin={0}
            aria-valuemax={7}
            className="h-2.5 w-full overflow-hidden rounded-full bg-[#E0F0E8] dark:bg-[#0F1A12]"
          >
            <div
              className="h-full rounded-full bg-[#8FC9B5] transition-all duration-300"
              style={{ width: `${gad7Percent}%` }}
            />
          </div>
        </div>

        {/* PHQ-9 Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
              PHQ-9 (Estado de ánimo)
            </span>
            <span className="font-mono font-semibold text-[#7B6FD8] tabular-nums dark:text-[#A89AE8]">
              {phq9Completed}/9
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso en cuestionario PHQ-9"
            aria-valuenow={phq9Completed}
            aria-valuemin={0}
            aria-valuemax={9}
            className="h-2.5 w-full overflow-hidden rounded-full bg-[#ECE8FA] dark:bg-[#0F1A12]"
          >
            <div
              className="h-full rounded-full bg-[#7B6FD8] transition-all duration-300"
              style={{ width: `${phq9Percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Semáforo clínico cuando ya existe resultado */}
      {semaforo && activeNivel && (
        <div className={`mt-4 rounded-lg border p-3 ${semaforo.containerClass}`}>
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-2"
              aria-label={`Semaforización: ${semaforo.label}`}
            >
              <div className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-1 dark:bg-[#0F1A12]/80">
                <span
                  className={`size-2.5 rounded-full bg-[#1F4D2C] ${
                    activeNivel === "verde" ? "ring-2 ring-[#1F4D2C]/40" : "opacity-25"
                  }`}
                />
                <span
                  className={`size-2.5 rounded-full bg-[#B8860B] ${
                    activeNivel === "amarillo" ? "ring-2 ring-[#B8860B]/40" : "opacity-25"
                  }`}
                />
                <span
                  className={`size-2.5 rounded-full bg-[#C8102E] ${
                    activeNivel === "rojo" ? "ring-2 ring-[#C8102E]/40" : "opacity-25"
                  }`}
                />
              </div>
              <Badge
                className={`rounded-md border-0 px-2 py-0.5 text-[11px] font-bold ${semaforo.badgeClass}`}
              >
                {semaforo.label}
              </Badge>
            </div>
          </div>
          <p className="mt-1.5 text-xs font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
            {semaforo.detail}
          </p>
          {screeningState.step === "completed" && (
            <p className="mt-1 font-mono text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
              GAD-7: {gad7Total}/21 · PHQ-9: {phq9Total}/27
            </p>
          )}
        </div>
      )}

      {/* Folio generado */}
      <div className="mt-4 border-t border-[#E5DFD3] pt-3.5 dark:border-[#2D3F2A]">
        {activeFolio ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#B8860B]/30 bg-[#F5F1E8] px-3 py-2 dark:border-[#B8860B]/40 dark:bg-[#0F1A12]">
            <div className="flex min-w-0 items-center gap-2">
              <Ticket className="size-4 shrink-0 text-[#B8860B]" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Folio asignado
                </p>
                <p className="truncate font-mono text-xs font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                  {activeFolio}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyFolio}
              className="h-8 shrink-0 cursor-pointer gap-1.5 rounded-md border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#E0F0E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]"
            >
              <Copy className="size-3.5" strokeWidth={1.75} />
              <span>Copiar</span>
            </Button>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
            Tu folio clínico (<span className="font-mono font-semibold">EQ-XXXX</span>) se generará
            automáticamente al concluir las 16 preguntas.
          </p>
        )}
      </div>
    </section>
  );
}
