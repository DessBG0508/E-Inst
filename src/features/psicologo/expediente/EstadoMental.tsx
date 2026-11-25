import React from "react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { EstadoMentalData } from "./types";

interface EstadoMentalProps {
  estadoMental: EstadoMentalData;
  onChange: (patch: Partial<EstadoMentalData>) => void;
}

export const EstadoMental: React.FC<EstadoMentalProps> = ({ estadoMental, onChange }) => {
  const items: Array<{ key: keyof Omit<EstadoMentalData, "observaciones">; label: string }> = [
    { key: "aspecto_cuidado", label: "Aspecto cuidado" },
    { key: "orientado", label: "Orientado" },
    { key: "contacto_adecuado", label: "Contacto adecuado" },
    { key: "discurso_coherente", label: "Discurso coherente" },
    { key: "animo_bajo", label: "Ánimo bajo" },
    { key: "ansiedad_manifiesta", label: "Ansiedad manifiesta" },
    { key: "enlentecimiento", label: "Enlentecimiento" },
    { key: "inquietud_psicomotriz", label: "Inquietud psicomotriz" },
    { key: "sueno_alterado", label: "Sueño alterado" },
    { key: "pensamiento_perseverante", label: "Pensamiento perseverante" },
    { key: "afecto_congruente", label: "Afecto congruente" },
    { key: "juicio_conservado", label: "Juicio conservado" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            06
          </span>
          <h3 className="text-base font-semibold tracking-tight text-white">
            Exploración del estado mental
          </h3>
        </div>
        <span className="text-xs font-normal text-white/80 sm:ml-2">
          Observación clínica directa del profesional
        </span>
      </div>

      <div className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ key, label }) => {
            const isChecked = Boolean(estadoMental[key]);
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#E5DFD3] bg-white p-3 transition-colors hover:border-[#1F4D2C]/50 dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:hover:border-[#8FC9B5]/50"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => onChange({ [key]: e.target.checked })}
                  className="size-4 rounded border-[#E5DFD3] accent-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A]"
                />
                <span className="text-sm font-medium text-[#1A1A1A] select-none dark:text-[#F5F1E8]">
                  {label}
                </span>
              </label>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="observaciones-mental-input"
              className="block text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
            >
              Observaciones semiológicas complementarias
            </label>
            <BadgeOrigen tipo="PSICÓLOGO" />
          </div>
          <textarea
            id="observaciones-mental-input"
            rows={4}
            value={estadoMental.observaciones}
            onChange={(e) => onChange({ observaciones: e.target.value })}
            placeholder="Alineación afectiva, modulación de voz, contacto ocular, psicomotricidad..."
            className="w-full resize-y rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-sm leading-relaxed text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:placeholder:text-[#A6B5A3]/60"
          />
        </div>
      </div>
    </div>
  );
};
