import React from "react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { ContextoPsicosocialData } from "./types";
import type { PacienteParaPsicologo } from "../semaforo-pacientes";

interface ContextoPsicosocialProps {
  paciente: PacienteParaPsicologo | null;
  contexto: ContextoPsicosocialData;
  onChange: (patch: Partial<ContextoPsicosocialData>) => void;
}

const READONLY_CLASS =
  "w-full rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 text-sm font-medium text-[#6B6B6B] cursor-default focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]";

const EDITABLE_CLASS =
  "w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:placeholder:text-[#A6B5A3]/60";

export const ContextoPsicosocial: React.FC<ContextoPsicosocialProps> = ({
  paciente,
  contexto,
  onChange,
}) => {
  const carreraSemestre =
    contexto.carrera_semestre ||
    `${paciente?.carrera || "TESH Huixquilucan"} · ${
      paciente?.semestre
        ? `${String(paciente.semestre).replace(/º\s*Semestre/i, "")}º Semestre`
        : "Sin semestre"
    }`;
  const grupo = contexto.grupo || paciente?.grupo || "Sin grupo";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            05
          </span>
          <h3 className="text-base font-semibold tracking-tight text-white">
            Contexto psicosocial
          </h3>
        </div>
        <span className="text-xs font-normal text-white/80 sm:ml-2">
          Con quién vive, situación laboral y redes de apoyo
        </span>
      </div>

      <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ctx-carrera"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Carrera y semestre
              </label>
              <BadgeOrigen tipo="AUTOMÁTICO" />
            </div>
            <input
              id="ctx-carrera"
              type="text"
              readOnly
              value={carreraSemestre}
              className={READONLY_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ctx-grupo"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Grupo
              </label>
              <BadgeOrigen tipo="AUTOMÁTICO" />
            </div>
            <input
              id="ctx-grupo"
              type="text"
              readOnly
              value={grupo}
              className={`${READONLY_CLASS} font-mono`}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ctx-convivencia"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Convivencia
              </label>
              <BadgeOrigen tipo="PSICÓLOGO" />
            </div>
            <input
              id="ctx-convivencia"
              type="text"
              value={contexto.convivencia}
              onChange={(e) => onChange({ convivencia: e.target.value })}
              placeholder="Padres, pareja, solo/a, roomies..."
              className={EDITABLE_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ctx-laboral"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Situación laboral
              </label>
              <BadgeOrigen tipo="PSICÓLOGO" />
            </div>
            <input
              id="ctx-laboral"
              type="text"
              value={contexto.situacion_laboral}
              onChange={(e) => onChange({ situacion_laboral: e.target.value })}
              placeholder="Solo estudia, medio tiempo, tiempo completo..."
              className={EDITABLE_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ctx-red"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Red de apoyo
              </label>
              <BadgeOrigen tipo="PSICÓLOGO" />
            </div>
            <input
              id="ctx-red"
              type="text"
              value={contexto.red_apoyo}
              onChange={(e) => onChange({ red_apoyo: e.target.value })}
              placeholder="Familiares, amistades, tutoría docente..."
              className={EDITABLE_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ctx-estres"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Factores de estrés actuales
              </label>
              <BadgeOrigen tipo="PSICÓLOGO" />
            </div>
            <input
              id="ctx-estres"
              type="text"
              value={contexto.factores_estres}
              onChange={(e) => onChange({ factores_estres: e.target.value })}
              placeholder="Académicos, económicos, familiares, traslado..."
              className={EDITABLE_CLASS}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
