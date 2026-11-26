import { useState, type FormEvent } from "react";
import { Calendar, Clock, Info, Loader2, MapPin, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MOTIVO_MAX_LENGTH,
  formatFechaLegible,
  type PsicologoDisponible,
  type TipoProfesional,
} from "./types";

interface FormularioSolicitudProps {
  fechaCita: string;
  horaCita: string;
  psicologoAsignado: PsicologoDisponible;
  tipoProfesional?: TipoProfesional;
  onSubmit: (motivo: string) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function FormularioSolicitud({
  fechaCita,
  horaCita,
  psicologoAsignado,
  tipoProfesional = "psicologo",
  onSubmit,
  onCancel,
  isSubmitting = false,
}: FormularioSolicitudProps) {
  const [motivo, setMotivo] = useState("");
  const esMedico = tipoProfesional === "medico" || psicologoAsignado.especialidad === "medico";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(motivo.slice(0, MOTIVO_MAX_LENGTH));
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
      <section
        aria-labelledby="solicitud-heading"
        className="space-y-6 rounded-lg border border-[#E5DFD3] bg-white p-6 sm:p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
          <div>
            <h2
              id="solicitud-heading"
              className="text-xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]"
            >
              {esMedico ? "Confirmar cita con Servicio Médico" : "Confirmar solicitud de cita"}
            </h2>
            <p className="mt-1 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Revisa los datos asignados antes de registrar tu espacio presencial.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1F4D2C]/25 bg-[#E0F0E8] px-3 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
            <MapPin className="size-3.5" aria-hidden="true" />
            Solo presencial
          </span>
        </div>

        {/* Resumen: Fecha + Hora + Especialista asignado automáticamente */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 sm:grid-cols-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              <Calendar className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
              Fecha
            </span>
            <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
              {formatFechaLegible(fechaCita)}
            </p>
          </div>

          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              <Clock className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
              Hora
            </span>
            <p className="text-sm font-semibold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
              {horaCita} hrs
            </p>
          </div>

          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              <UserCheck className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
              {esMedico ? "Médico asignado" : "Psicólogo asignado"}
            </span>
            <p className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
              {psicologoAsignado.nombre}
            </p>
            <p className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
              {psicologoAsignado.consultorio}
            </p>
          </div>
        </div>

        {/* Motivo opcional (máx. 280 caracteres) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="motivo-cita-textarea"
              className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
            >
              {esMedico ? "Motivo de consulta médica (opcional)" : "Motivo de consulta (opcional)"}
            </Label>
            <span className="text-xs font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
              {motivo.length}/{MOTIVO_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id="motivo-cita-textarea"
            rows={4}
            maxLength={MOTIVO_MAX_LENGTH}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, MOTIVO_MAX_LENGTH))}
            placeholder={
              esMedico
                ? "Describe tus síntomas físicos o motivo de valoración médica (ej. insomnio, dolor de cabeza, fatiga, malestar estomacal)..."
                : "Describe brevemente el motivo o tema que deseas tratar en tu sesión presencial..."
            }
            className="resize-none rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
          />
        </div>

        {/* Aviso institucional */}
        <div className="flex items-start gap-2.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/70 p-3.5 text-xs font-medium text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
          <Info className="mt-0.5 size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          <p>Recibirás confirmación por correo. Puedes cancelar hasta 2 horas antes.</p>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col-reverse gap-3 border-t border-[#E5DFD3] pt-4 sm:flex-row sm:justify-end dark:border-[#2D3F2A]">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={onCancel}
            className="h-11 rounded-lg px-5 text-sm font-semibold text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1A1A1A] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12]"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-lg bg-[#1F4D2C] px-6 text-sm font-semibold text-white hover:bg-[#4A7C59]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Confirmando...
              </>
            ) : (
              "Confirmar cita"
            )}
          </Button>
        </div>
      </section>
    </form>
  );
}
