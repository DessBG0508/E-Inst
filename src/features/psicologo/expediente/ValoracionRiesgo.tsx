import React from "react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { ValoracionRiesgoData, MarcadoresRiesgoData } from "./types";
import type { PacienteParaPsicologo } from "../semaforo-pacientes";

interface ValoracionRiesgoProps {
  paciente: PacienteParaPsicologo | null;
  valoracion: ValoracionRiesgoData;
  onChange: (patch: Partial<ValoracionRiesgoData>) => void;
}

export const ValoracionRiesgo: React.FC<ValoracionRiesgoProps> = ({
  paciente,
  valoracion,
  onChange,
}) => {
  const item9Valor = paciente?.item9 ?? valoracion.item9_valor ?? 0;

  const marcadoresConfig: Array<{ key: keyof MarcadoresRiesgoData; label: string }> = [
    { key: "ideacion_autolitica", label: "Ideación autolítica" },
    { key: "plan_estructurado", label: "Plan estructurado" },
    { key: "intentos_previos", label: "Intentos previos" },
    { key: "autolesiones", label: "Autolesiones" },
    { key: "consumo_sustancias", label: "Consumo de sustancias" },
    { key: "riesgo_terceros", label: "Riesgo hacia terceros" },
  ];

  const handleMarcadorChange = (key: keyof MarcadoresRiesgoData, checked: boolean) => {
    onChange({
      marcadores: {
        ...valoracion.marcadores,
        [key]: checked,
      },
    });
  };

  const getScaleColor = (num: number, isSelected: boolean) => {
    if (!isSelected) {
      return "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:border-[#1F4D2C]/50";
    }
    if (num <= 3) {
      return "bg-[#1F4D2C] border-[#1F4D2C] text-white";
    }
    if (num <= 6) {
      return "bg-[#B8860B] border-[#B8860B] text-white";
    }
    return "bg-[#C8102E] border-[#C8102E] text-white";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            07
          </span>
          <h3 className="text-base font-semibold tracking-tight text-white">
            Valoración de riesgo
          </h3>
        </div>
        <span className="text-xs font-normal text-white/80 sm:ml-2">
          Exploración explícita de seguridad clínica y factores protectores
        </span>
      </div>

      <div className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div
          className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:gap-4 ${
            item9Valor >= 1 ? "border-[#C8102E]/40 bg-[#FEE2E2]" : "border-[#E5DFD3] bg-[#F5F1E8]"
          }`}
        >
          <div className="flex items-center gap-2 shrink-0">
            <BadgeOrigen tipo="AUTOMÁTICO" />
            <span
              className={`text-sm font-semibold ${
                item9Valor >= 1 ? "text-[#C8102E]" : "text-[#1F4D2C]"
              }`}
            >
              Ítem 9 del PHQ-9
            </span>
          </div>
          <p
            className={`text-sm leading-relaxed ${item9Valor >= 1 ? "text-[#1A1A1A]" : "text-[#6B6B6B]"}`}
          >
            Valor del último PHQ-9: <strong className="font-bold">{item9Valor}</strong> (0 = mínimo,
            3 = máximo).{" "}
            {item9Valor >= 1
              ? "Cualquier valor ≥ 1 activa alerta roja y bloqueo preventivo hasta atención clínica."
              : "Sin reporte de ideación en el último reactivo."}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#1F4D2C]">
              Marcadores de riesgo (preguntar explícitamente)
            </span>
            <BadgeOrigen tipo="PSICÓLOGO" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {marcadoresConfig.map(({ key, label }) => {
              const checked = Boolean(valoracion.marcadores?.[key]);
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#E5DFD3] bg-white p-3 transition-colors hover:border-[#1F4D2C]/50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleMarcadorChange(key, e.target.checked)}
                    className="size-4 rounded border-[#E5DFD3] accent-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
                  />
                  <span className="text-sm font-medium text-[#1A1A1A] select-none">{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[#1F4D2C]">
              Riesgo clínico estimado en este momento (escala 0-10)
            </span>
            <BadgeOrigen tipo="MIXTO" />
          </div>

          <div className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isSelected = valoracion.riesgo_estimado === num;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => onChange({ riesgo_estimado: num })}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] ${getScaleColor(
                      num,
                      isSelected,
                    )}`}
                  >
                    {num}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-semibold px-1">
              <span className="text-[#1F4D2C]">Bajo (0-3)</span>
              <span className="text-[#B8860B]">Moderado (4-6)</span>
              <span className="text-[#C8102E]">Alto (7-10)</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="factores-proteccion-input"
              className="text-sm font-semibold text-[#1F4D2C]"
            >
              Factores de protección y medidas acordadas
            </label>
            <BadgeOrigen tipo="PSICÓLOGO" />
          </div>
          <textarea
            id="factores-proteccion-input"
            rows={4}
            value={valoracion.factores_proteccion}
            onChange={(e) => onChange({ factores_proteccion: e.target.value })}
            placeholder="Factores protectores identificados, plan de seguridad y red de contención acordada..."
            className="w-full resize-y rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-sm leading-relaxed text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
          />
        </div>
      </div>
    </div>
  );
};
