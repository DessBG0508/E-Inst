import React from "react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { PacienteParaPsicologo } from "../semaforo-pacientes";

interface MotivoConsultaProps {
  paciente: PacienteParaPsicologo | null;
  motivoEnPalabras: string;
  onChange: (motivo: string) => void;
  tamizajeFecha?: string;
  transcriptVoz?: string | null;
}

export const MotivoConsulta: React.FC<MotivoConsultaProps> = ({
  paciente,
  motivoEnPalabras,
  onChange,
  tamizajeFecha = "Reciente",
  transcriptVoz,
}) => {
  const phq9Total = paciente?.phq9_total ?? 0;
  const gad7Total = paciente?.gad7_total ?? 0;
  const item9 = paciente?.item9 ?? 0;
  const nivel = (paciente?.ultimo_nivel || "ROJO").toUpperCase();

  const textoSugeridoDefault = `Estudiante canalizado desde tamizaje con nivel ${nivel} (PHQ-9: ${phq9Total}/27, GAD-7: ${gad7Total}/21, ítem 9=${item9}) en fecha ${tamizajeFecha}. Registro automático de referencia para entrevista clínica.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            02
          </span>
          <h3 className="text-base font-semibold tracking-tight text-white">Motivo de consulta</h3>
        </div>
        <span className="text-xs font-normal text-white/80 sm:ml-2">
          Con las palabras del estudiante, antes de traducirlo a lenguaje clínico
        </span>
      </div>

      <div className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 sm:flex-row sm:items-start sm:gap-4">
          <BadgeOrigen tipo="AUTOMÁTICO" className="shrink-0 self-start" />
          <p className="text-sm leading-relaxed text-[#6B6B6B]">{textoSugeridoDefault}</p>
        </div>

        {transcriptVoz && (
          <div className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 text-sm text-[#6B6B6B]">
            <span className="font-semibold text-[#1F4D2C]">Transcripción de voz registrada:</span>{" "}
            &ldquo;{transcriptVoz}&rdquo;
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="motivo-estudiante-input"
              className="block text-sm font-semibold text-[#1F4D2C]"
            >
              Motivo en palabras del estudiante
            </label>
            <BadgeOrigen tipo="PSICÓLOGO" />
          </div>
          <textarea
            id="motivo-estudiante-input"
            rows={6}
            value={motivoEnPalabras}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe el motivo de consulta textual referido por el estudiante durante la entrevista..."
            className="w-full resize-y rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-sm leading-relaxed text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
          />
        </div>
      </div>
    </div>
  );
};
