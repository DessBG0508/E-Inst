import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatFechaLegible,
  verificarVentanaCancelacion,
  type EstadoCita,
  type SolicitudCita,
} from "./types";

interface EstadoCitaProps {
  citas: SolicitudCita[];
  onCancelarCita: (citaId: string, fechaCita: string, horaCita: string) => Promise<void>;
  onNuevaSolicitud: () => void;
  isCancelingId?: string | null;
}

const ESTADO_PILL: Record<EstadoCita, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-[#B8860B] text-white",
  },
  confirmada: {
    label: "Confirmada",
    className: "bg-[#1F4D2C] text-white",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-[#6B6B6B] text-white",
  },
  completada: {
    label: "Completada",
    className: "bg-[#8FC9B5] text-white",
  },
  no_asistio: {
    label: "No asistí",
    className: "bg-[#C8102E] text-white",
  },
};

export function EstadoCitaList({
  citas,
  onCancelarCita,
  onNuevaSolicitud,
  isCancelingId = null,
}: EstadoCitaProps) {
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const hasActive =
    citas.some(
      (c) =>
        (c.tipo_profesional || "psicologo") === "psicologo" &&
        (c.estado === "pendiente" || c.estado === "confirmada"),
    ) &&
    citas.some(
      (c) =>
        c.tipo_profesional === "medico" && (c.estado === "pendiente" || c.estado === "confirmada"),
    );

  return (
    <div className="space-y-6">
      {/* Encabezado de Mis Citas */}
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
            Mis citas
          </h2>
          <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            Historial y estado actual de tus citas presenciales en Bienestar Estudiantil TESH.
          </p>
        </div>

        <Button
          type="button"
          onClick={onNuevaSolicitud}
          disabled={hasActive}
          className="h-10 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59] disabled:opacity-50"
        >
          <CalendarPlus className="mr-1.5 size-4" />
          Agendar nueva cita
        </Button>
      </div>

      {citas.length === 0 ? (
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-10 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <Calendar className="mx-auto mb-3 size-8 text-[#6B6B6B]" />
          <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
            Aún no tienes citas registradas
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
            Selecciona un día hábil y un horario presencial en el calendario para programar tu
            primera cita.
          </p>
          <Button
            type="button"
            onClick={onNuevaSolicitud}
            className="mt-5 h-11 rounded-lg bg-[#1F4D2C] px-6 text-sm font-semibold text-white hover:bg-[#4A7C59]"
          >
            Ir al calendario
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {citas.map((cita) => {
            const pill = ESTADO_PILL[cita.estado] || ESTADO_PILL.pendiente;
            const isActiva = cita.estado === "pendiente" || cita.estado === "confirmada";
            const esMedico = cita.tipo_profesional === "medico";
            // Validación estricta fail-closed (> 2 horas)
            const ventana = verificarVentanaCancelacion(cita.fecha_cita, cita.hora_cita);
            const showCancelarButton = isActiva && ventana.puedeCancelar;
            const isConfirmingThis = confirmCancelId === cita.id;
            const isCancelingThis = isCancelingId === cita.id;

            return (
              <article
                key={cita.id}
                className="rounded-lg border border-[#E5DFD3] bg-white p-5 sm:p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Datos principales de la cita */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${pill.className}`}
                      >
                        {pill.label}
                      </span>
                      <span className="inline-flex items-center rounded border border-[#E5DFD3] bg-[#F5F1E8] px-2 py-0.5 text-[11px] font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                        {esMedico ? "Médico universitario" : "Psicología"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        <MapPin className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                        Solo presencial
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                      <span className="inline-flex items-center gap-1.5 font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        <Calendar className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                        {formatFechaLegible(cita.fecha_cita)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                        <Clock className="size-4" />
                        {cita.hora_cita} hrs
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      <UserCheck className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      <span>
                        {esMedico ? "Médico asignado: " : "Psicólogo asignado: "}
                        <strong className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {cita.nombre_psicologo ||
                            (esMedico ? "Dr. Alejandro Vega" : "Dra. Marta Gómez")}
                        </strong>
                      </span>
                    </div>

                    {cita.motivo && (
                      <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Motivo: {cita.motivo}
                      </p>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    {showCancelarButton && !isConfirmingThis && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isCancelingThis}
                        onClick={() => setConfirmCancelId(cita.id)}
                        className="h-9 rounded-lg border-[#C8102E]/40 text-xs font-semibold text-[#C8102E] hover:bg-[#FEE2E2] hover:text-[#C8102E]"
                      >
                        Cancelar
                      </Button>
                    )}

                    {cita.estado === "completada" && (
                      <Link
                        to="/encuesta"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#1F4D2C]/30 bg-[#E0F0E8] px-3 text-xs font-semibold text-[#1F4D2C] transition-colors hover:bg-[#1F4D2C] hover:text-white dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Encuesta de satisfacción (24h)
                      </Link>
                    )}
                  </div>
                </div>

                {/* Confirmación de cancelación (> 2h) */}
                {showCancelarButton && isConfirmingThis && (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-[#C8102E]/30 bg-[#FEE2E2] p-3.5 sm:flex-row sm:items-center">
                    <p className="text-xs font-semibold text-[#C8102E]">
                      ¿Confirmas cancelar tu cita del {cita.fecha_cita} a las {cita.hora_cita} hrs?
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isCancelingThis}
                        onClick={() => setConfirmCancelId(null)}
                        className="h-8 text-xs font-semibold text-[#1A1A1A]"
                      >
                        Volver
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isCancelingThis}
                        onClick={async () => {
                          await onCancelarCita(cita.id, cita.fecha_cita, cita.hora_cita);
                          setConfirmCancelId(null);
                        }}
                        className="h-8 rounded-lg bg-[#C8102E] px-3 text-xs font-semibold text-white hover:bg-[#9B0C24]"
                      >
                        {isCancelingThis ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : null}
                        Confirmar cancelación
                      </Button>
                    </div>
                  </div>
                )}

                {/* Aviso fail-closed cuando faltan <= 2h para cita activa */}
                {isActiva && !ventana.puedeCancelar && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-3 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#B8860B]" />
                    <span>{ventana.mensaje}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
