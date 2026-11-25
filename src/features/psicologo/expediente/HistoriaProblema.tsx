import React from "react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { PacienteParaPsicologo } from "../semaforo-pacientes";

interface HistoriaProblemaProps {
  paciente: PacienteParaPsicologo | null;
  historiaClinica: string;
  onChange: (historia: string) => void;
  historialTamizajesTexto?: string;
}

export const HistoriaProblema: React.FC<HistoriaProblemaProps> = ({
  paciente,
  historiaClinica,
  onChange,
  historialTamizajesTexto,
}) => {
  const gad7 = paciente?.gad7_total ?? 0;
  const phq9 = paciente?.phq9_total ?? 0;
  const item9 = paciente?.item9 ?? 0;

  const defaultHistorialAuto =
    historialTamizajesTexto ||
    `Último tamizaje registrado: GAD-7 = ${gad7}/21, PHQ-9 = ${phq9}/27, ítem 9 = ${item9} (Nivel ${String(paciente?.ultimo_nivel || "sin definir").toUpperCase()}). Historial sincronizado automáticamente para evaluación longitudinal.`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            03
          </span>
          <h3 className="text-base font-semibold tracking-tight text-white">
            Historia del problema
          </h3>
        </div>
        <span className="text-xs font-normal text-white/80 sm:ml-2">
          Inicio, evolución sintomática y estrategias previas
        </span>
      </div>

      <div className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6">
        <div className="flex flex-col gap-3 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12] sm:flex-row sm:items-start sm:gap-4">
          <BadgeOrigen tipo="AUTOMÁTICO" className="shrink-0 self-start" />
          <p className="text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
            {defaultHistorialAuto}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="historia-clinica-input"
              className="block text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
            >
              Historia clínica del problema
            </label>
            <BadgeOrigen tipo="PSICÓLOGO" />
          </div>
          <textarea
            id="historia-clinica-input"
            rows={5}
            value={historiaClinica}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Registra la cronología del malestar, desencadenantes académicos o personales e intentos previos de afrontamiento..."
            className="w-full resize-y rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-sm leading-relaxed text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:placeholder:text-[#A6B5A3]/60"
          />
        </div>
      </div>
    </div>
  );
};
