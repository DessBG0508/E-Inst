import React from "react";
import { BadgeOrigen } from "./BadgeOrigen";

interface HipotesisTrabajoProps {
  hipotesis: string;
  onChange: (hipotesis: string) => void;
}

export const HipotesisTrabajo: React.FC<HipotesisTrabajoProps> = ({ hipotesis, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            08
          </span>
          <h3 className="text-base font-semibold tracking-tight text-white">
            Hipótesis de trabajo
          </h3>
        </div>
        <span className="text-xs font-normal text-white/80 sm:ml-2">
          Formulación provisional sujeta a revisión longitudinal
        </span>
      </div>

      <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="hipotesis-trabajo-input"
              className="block text-sm font-semibold text-[#1F4D2C]"
            >
              Conceptualización clínica inicial
            </label>
            <BadgeOrigen tipo="PSICÓLOGO" />
          </div>
          <textarea
            id="hipotesis-trabajo-input"
            rows={4}
            value={hipotesis}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Formula la hipótesis clínica provisional (factores predisponentes, precipitantes y de mantenimiento)..."
            className="w-full resize-y rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-sm leading-relaxed text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
          />
        </div>
      </div>
    </div>
  );
};
