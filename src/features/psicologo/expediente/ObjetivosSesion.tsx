import React from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, Lock, Unlock } from "lucide-react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { ObjetivosSesionData } from "./types";
import type { PacienteParaPsicologo } from "../semaforo-pacientes";

interface ObjetivosSesionProps {
  paciente: PacienteParaPsicologo | null;
  objetivos: ObjetivosSesionData;
  onChange: (patch: Partial<ObjetivosSesionData>) => void;
  onLiberarPaciente?: () => void;
}

export const ObjetivosSesion: React.FC<ObjetivosSesionProps> = ({
  paciente,
  objetivos,
  onChange,
  onLiberarPaciente,
}) => {
  const isBloqueado = paciente?.bloqueado ?? objetivos.estado_bloqueo === "bloqueado";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
          09
        </span>
        <h3 className="text-base font-semibold tracking-tight text-white">
          Objetivos iniciales y próxima sesión
        </h3>
      </div>

      <div className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="divide-y divide-[#E5DFD3]">
          <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold text-[#1F4D2C] sm:w-1/3">
              Consentimiento informado
            </span>
            <div className="sm:w-1/2">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 px-3 py-2">
                <input
                  type="checkbox"
                  checked={objetivos.consentimiento_firmado}
                  onChange={(e) => onChange({ consentimiento_firmado: e.target.checked })}
                  className="size-4 rounded border-[#E5DFD3] accent-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
                />
                <span className="text-sm font-medium text-[#1A1A1A]">
                  He obtenido consentimiento informado del paciente
                </span>
              </label>
            </div>
            <div className="sm:w-1/6 sm:text-right">
              <BadgeOrigen tipo="PSICÓLOGO" />
            </div>
          </div>

          <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <label
              htmlFor="obj-frecuencia"
              className="text-sm font-semibold text-[#1F4D2C] sm:w-1/3"
            >
              Frecuencia acordada
            </label>
            <div className="sm:w-1/2">
              <select
                id="obj-frecuencia"
                value={objetivos.frecuencia_acordada || "Semanal"}
                onChange={(e) => onChange({ frecuencia_acordada: e.target.value })}
                className="w-full max-w-xs rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm font-medium text-[#1A1A1A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
              >
                <option value="Semanal">Semanal</option>
                <option value="Quincenal">Quincenal</option>
                <option value="Mensual">Mensual</option>
                <option value="A demanda">A demanda / Seguimiento puntual</option>
              </select>
            </div>
            <div className="sm:w-1/6 sm:text-right">
              <BadgeOrigen tipo="PSICÓLOGO" />
            </div>
          </div>

          <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <label
              htmlFor="obj-proxima-cita"
              className="text-sm font-semibold text-[#1F4D2C] sm:w-1/3"
            >
              Próxima cita
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:w-1/2">
              <input
                id="obj-proxima-cita"
                type="text"
                value={objetivos.proxima_cita}
                onChange={(e) => onChange({ proxima_cita: e.target.value })}
                placeholder="Ej. 10-nov-2026 10:00 AM"
                className="w-full max-w-xs rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
              />
              <Link
                to="/psicologo"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 text-xs font-semibold text-[#1F4D2C] hover:bg-[#E5DFD3]/60 print:hidden"
              >
                <Calendar className="size-3.5" />
                <span>Agenda</span>
              </Link>
            </div>
            <div className="sm:w-1/6 sm:text-right">
              <BadgeOrigen tipo="PSICÓLOGO" />
            </div>
          </div>

          <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold text-[#1F4D2C] sm:w-1/3">Estado de bloqueo</span>
            <div className="flex flex-wrap items-center gap-3 sm:w-1/2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold ${
                  isBloqueado ? "bg-[#FEE2E2] text-[#C8102E]" : "bg-[#E0F0E8] text-[#1F4D2C]"
                }`}
              >
                {isBloqueado ? (
                  <>
                    <Lock className="size-3.5" /> Bloqueado por tamizaje rojo
                  </>
                ) : (
                  <>
                    <Unlock className="size-3.5" /> Liberado para nuevo tamizaje
                  </>
                )}
              </span>

              {isBloqueado && onLiberarPaciente && (
                <button
                  type="button"
                  onClick={onLiberarPaciente}
                  className="h-9 rounded-lg bg-[#1F4D2C] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#4A7C59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] print:hidden"
                >
                  Atendido — Liberar
                </button>
              )}
            </div>
            <div className="sm:w-1/6 sm:text-right">
              <BadgeOrigen tipo="MIXTO" />
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="notas-libres-input" className="text-sm font-semibold text-[#1F4D2C]">
              Notas libres y plan terapéutico
            </label>
            <BadgeOrigen tipo="PSICÓLOGO" />
          </div>
          <textarea
            id="notas-libres-input"
            rows={4}
            value={objetivos.notas_libres}
            onChange={(e) => onChange({ notas_libres: e.target.value })}
            placeholder="Objetivos iniciales, acuerdos terapéuticos, indicaciones entre sesiones..."
            className="w-full resize-y rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-sm leading-relaxed text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
          />
        </div>
      </div>
    </div>
  );
};
