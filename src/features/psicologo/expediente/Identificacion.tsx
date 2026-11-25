import React from "react";
import { Lock } from "lucide-react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { CamposClinicos } from "./types";
import type { PacienteParaPsicologo } from "../semaforo-pacientes";

interface IdentificacionProps {
  paciente: PacienteParaPsicologo | null;
  campos: CamposClinicos;
  onChange?: (patch: Partial<CamposClinicos>) => void;
  fechaApertura?: string;
  numeroExpediente?: string;
}

const READONLY_FIELD_CLASS =
  "w-full rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 text-sm font-medium text-[#6B6B6B] cursor-default focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]";

const LABEL_CLASS = "text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]";

export const Identificacion: React.FC<IdentificacionProps> = ({
  paciente,
  campos,
  fechaApertura,
  numeroExpediente,
}) => {
  const folio = paciente?.folio || "EQ-9374";
  const numClean = folio
    .replace(/[^0-9]/g, "")
    .slice(-4)
    .padStart(4, "0");
  const numExpedienteFinal = numeroExpediente || campos.numero_expediente || `EXP-2026-${numClean}`;
  const fechaEfectiva =
    campos.fecha_apertura ||
    fechaApertura ||
    new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const nombreDisplay =
    paciente?.nombre || `Estudiante ${campos.iniciales || paciente?.iniciales || "TESH"}`;
  const matriculaDisplay = paciente?.matricula || "Matrícula institucional reservada";
  const inicialesDisplay = campos.iniciales || paciente?.iniciales || "Sin registro";
  const edadDisplay = String(campos.edad ?? paciente?.edad ?? "No especificada");
  const sexoDisplay = campos.sexo || paciente?.sexo || "No especificado";
  const semestreDisplay =
    campos.semestre ||
    (paciente?.semestre
      ? `${String(paciente.semestre).replace(/º\s*Semestre/i, "")}º Semestre`
      : "No especificado");
  const carreraDisplay = campos.carrera || paciente?.carrera || "TESH Huixquilucan";
  const grupoDisplay = campos.grupo || paciente?.grupo || "Sin grupo";
  const derivadoPor = campos.derivado_por || "Tamizaje preventivo Eli (Canalización institucional)";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            01
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight text-white">Identificación</h3>
            <p className="text-xs text-white/80">
              Datos poblados automáticamente desde Supabase (solo lectura)
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white self-start sm:self-auto print:hidden">
          <Lock className="size-3" />
          Solo lectura
        </span>
      </div>

      <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
            Ficha institucional del estudiante
          </p>
          <BadgeOrigen tipo="AUTOMÁTICO" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="id-numero-expediente" className={LABEL_CLASS}>
              Nº de expediente
            </label>
            <input
              id="id-numero-expediente"
              type="text"
              readOnly
              value={numExpedienteFinal}
              className={`${READONLY_FIELD_CLASS} font-mono`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-folio-tamizaje" className={LABEL_CLASS}>
              Folio de tamizaje
            </label>
            <input
              id="id-folio-tamizaje"
              type="text"
              readOnly
              value={folio}
              className={`${READONLY_FIELD_CLASS} font-mono`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-nombre" className={LABEL_CLASS}>
              Nombre / Identificador
            </label>
            <input
              id="id-nombre"
              type="text"
              readOnly
              value={nombreDisplay}
              className={READONLY_FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-matricula" className={LABEL_CLASS}>
              Matrícula TESH
            </label>
            <input
              id="id-matricula"
              type="text"
              readOnly
              value={matriculaDisplay}
              className={`${READONLY_FIELD_CLASS} font-mono`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-iniciales" className={LABEL_CLASS}>
              Iniciales
            </label>
            <input
              id="id-iniciales"
              type="text"
              readOnly
              value={inicialesDisplay}
              className={READONLY_FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-fecha-apertura" className={LABEL_CLASS}>
              Fecha de apertura
            </label>
            <input
              id="id-fecha-apertura"
              type="text"
              readOnly
              value={fechaEfectiva}
              className={READONLY_FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-edad" className={LABEL_CLASS}>
              Edad
            </label>
            <input
              id="id-edad"
              type="text"
              readOnly
              value={`${edadDisplay} años`}
              className={READONLY_FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-sexo" className={LABEL_CLASS}>
              Sexo
            </label>
            <input
              id="id-sexo"
              type="text"
              readOnly
              value={sexoDisplay}
              className={READONLY_FIELD_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="id-carrera" className={LABEL_CLASS}>
              Carrera
            </label>
            <input
              id="id-carrera"
              type="text"
              readOnly
              value={carreraDisplay}
              className={READONLY_FIELD_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="id-semestre" className={LABEL_CLASS}>
                Semestre
              </label>
              <input
                id="id-semestre"
                type="text"
                readOnly
                value={semestreDisplay}
                className={READONLY_FIELD_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="id-grupo" className={LABEL_CLASS}>
                Grupo
              </label>
              <input
                id="id-grupo"
                type="text"
                readOnly
                value={grupoDisplay}
                className={`${READONLY_FIELD_CLASS} font-mono`}
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="id-derivado" className={LABEL_CLASS}>
              Derivado por
            </label>
            <input
              id="id-derivado"
              type="text"
              readOnly
              value={derivadoPor}
              className={READONLY_FIELD_CLASS}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
