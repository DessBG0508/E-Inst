import { useEffect, useMemo, useState } from "react";
import { es } from "date-fns/locale";
import { Brain, Calendar as CalendarIcon, Clock, Loader2, MapPin, Stethoscope } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  HORARIOS_CONFIGURADOS,
  formatDateToISO,
  formatFechaLegible,
  isDiaFestivo,
  isDiaInhabilitado,
  type ProfesionalDisponible,
  type TipoProfesional,
} from "./types";
import {
  getCitasOcupadasPorFecha,
  getProfesionalDisponible,
  normalizarHoraSlot,
} from "./agenda-service";

interface CalendarioCitasProps {
  fechaPrevia?: string;
  tipoProfesional: TipoProfesional;
  onChangeTipoProfesional: (tipo: TipoProfesional) => void;
  onSelectSlot: (fecha: string, hora: string, profesional: ProfesionalDisponible) => void;
  hasActiveAppointment?: boolean;
  onGoToMisCitas?: () => void;
}

function getNextBusinessDay(fromDate: Date): Date {
  const candidate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  for (let i = 0; i < 30; i++) {
    if (!isDiaInhabilitado(candidate)) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  return fromDate;
}

function parseIsoToLocalDate(iso?: string): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

export function CalendarioCitas({
  fechaPrevia,
  tipoProfesional,
  onChangeTipoProfesional,
  onSelectSlot,
  hasActiveAppointment = false,
  onGoToMisCitas,
}: CalendarioCitasProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const prev = parseIsoToLocalDate(fechaPrevia);
    if (prev && !isDiaInhabilitado(prev)) return prev;
    return getNextBusinessDay(new Date());
  });

  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [resolvingHora, setResolvingHora] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const selectedDateStr = useMemo(() => formatDateToISO(selectedDate), [selectedDate]);

  useEffect(() => {
    let active = true;
    setIsLoadingSlots(true);
    setSlotError(null);

    getCitasOcupadasPorFecha(selectedDateStr, undefined, tipoProfesional)
      .then((ocupadas) => {
        if (active) setHorasOcupadas(ocupadas);
      })
      .catch(() => {
        if (active) setHorasOcupadas([]);
      })
      .finally(() => {
        if (active) setIsLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [selectedDateStr, tipoProfesional]);

  const matutinoSlots = useMemo(
    () => HORARIOS_CONFIGURADOS.filter((s) => s.turno === "matutino"),
    [],
  );
  const vespertinoSlots = useMemo(
    () => HORARIOS_CONFIGURADOS.filter((s) => s.turno === "vespertino"),
    [],
  );

  const handlePickSlot = async (hora: string) => {
    if (hasActiveAppointment) {
      const nombreArea =
        tipoProfesional === "medico" ? "Médico universitario" : "Psicólogo clínico";
      setSlotError(
        `Ya tienes una cita activa con ${nombreArea}. Cancela o completa tu cita actual antes de agendar otra.`,
      );
      return;
    }

    setSlotError(null);
    setResolvingHora(hora);
    try {
      const profesional = await getProfesionalDisponible(selectedDateStr, hora, tipoProfesional);
      if (!profesional) {
        setSlotError("Este horario ya fue ocupado. Por favor selecciona otro disponible.");
        const refreshed = await getCitasOcupadasPorFecha(
          selectedDateStr,
          undefined,
          tipoProfesional,
        );
        setHorasOcupadas(refreshed);
        return;
      }
      onSelectSlot(selectedDateStr, hora, profesional);
    } finally {
      setResolvingHora(null);
    }
  };

  const festivoInfo = isDiaFestivo(selectedDateStr);
  const esMedico = tipoProfesional === "medico";

  return (
    <div className="space-y-6">
      {/* Selector de tipo de profesional: Psicólogo vs Médico universitario */}
      <section
        aria-label="Selección de profesional de atención"
        className="rounded-lg border border-[#E5DFD3] bg-white p-4 sm:p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              ¿Con qué profesional deseas agendar?
            </p>
            <p className="mt-0.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              El Servicio Médico atiende síntomas físicos y el área de Psicología brinda apoyo
              emocional.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Tipo de profesional"
            className="grid grid-cols-2 gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-1 dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tipoProfesional === "psicologo"}
              onClick={() => onChangeTipoProfesional("psicologo")}
              className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
                tipoProfesional === "psicologo"
                  ? "bg-[#1F4D2C] text-white"
                  : "text-[#6B6B6B] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:text-[#8FC9B5]"
              }`}
            >
              <Brain className="size-4 shrink-0" />
              <span>Psicólogo</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tipoProfesional === "medico"}
              onClick={() => onChangeTipoProfesional("medico")}
              className={`inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
                tipoProfesional === "medico"
                  ? "bg-[#1F4D2C] text-white"
                  : "text-[#6B6B6B] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:text-[#8FC9B5]"
              }`}
            >
              <Stethoscope className="size-4 shrink-0" />
              <span>Médico universitario</span>
            </button>
          </div>
        </div>
      </section>

      {/* Badge superior fijo: Solo presencial (NO editable) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          aria-label="Modalidad de atención única"
          className="inline-flex items-center gap-2 rounded-full border border-[#1F4D2C]/25 bg-[#E0F0E8] px-3.5 py-1.5 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]"
        >
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Solo presencial</span>
          <span className="text-[#1F4D2C]/70 dark:text-[#8FC9B5]/80">· Modalidad única TESH</span>
        </div>

        <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
          Atención de lunes a viernes ·{" "}
          {esMedico
            ? "Médico universitario asignado automáticamente"
            : "Psicólogo asignado automáticamente"}
        </p>
      </div>

      {hasActiveAppointment && (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-[#B8860B]/40 bg-[#FBE6D5]/50 p-4 sm:flex-row sm:items-center dark:border-[#B8860B]/40 dark:bg-[#1A2618]">
          <p className="text-xs font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
            Ya tienes una solicitud o cita activa con{" "}
            {esMedico ? "Médico universitario" : "Psicólogo"}. Solo puedes tener 1 cita activa por
            especialidad a la vez.
          </p>
          {onGoToMisCitas && (
            <button
              type="button"
              onClick={onGoToMisCitas}
              className="shrink-0 cursor-pointer text-xs font-semibold text-[#1F4D2C] underline hover:text-[#4A7C59] dark:text-[#8FC9B5]"
            >
              Ver mis citas
            </button>
          )}
        </div>
      )}

      {/* Grid Principal: Calendario mensual a la izquierda + Slots a la derecha */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Columna Izquierda: Calendar de shadcn */}
        <section
          aria-label="Calendario mensual de citas"
          className="rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
        >
          <div className="mb-4 flex items-center gap-2 border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
            <CalendarIcon className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
            <h2 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              1. Selecciona un día hábil
            </h2>
          </div>

          <div className="flex justify-center">
            <Calendar
              mode="single"
              locale={es}
              selected={selectedDate}
              defaultMonth={selectedDate}
              onSelect={(date) => {
                if (date && !isDiaInhabilitado(date)) {
                  setSelectedDate(date);
                }
              }}
              disabled={isDiaInhabilitado}
              className="rounded-lg border border-[#E5DFD3] bg-white p-3 [--cell-size:2.4rem] dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
              classNames={{
                today:
                  "rounded-md bg-[#E0F0E8] font-semibold text-[#1F4D2C] dark:bg-[#1A2618] dark:text-[#8FC9B5]",
                day_button:
                  "data-[selected-single=true]:bg-[#1F4D2C] data-[selected-single=true]:text-white data-[selected-single=true]:hover:bg-[#1F4D2C] hover:bg-[#E0F0E8] hover:text-[#1F4D2C] dark:hover:bg-[#1A2618] dark:hover:text-[#8FC9B5]",
              }}
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
            Los fines de semana, fechas pasadas y días festivos oficiales permanecen inhabilitados.
          </p>
        </section>

        {/* Columna Derecha: Slots disponibles para el día seleccionado */}
        <section
          aria-label="Horarios disponibles para la fecha seleccionada"
          className="rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-7 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                2. Elige un horario disponible
              </h2>
              <p className="mt-0.5 text-xs font-medium text-[#1F4D2C] dark:text-[#8FC9B5]">
                {formatFechaLegible(selectedDateStr)}
              </p>
            </div>
            {isLoadingSlots && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                <Loader2 className="size-3.5 animate-spin text-[#1F4D2C]" />
                Verificando cupos...
              </span>
            )}
          </div>

          {festivoInfo.festivo ? (
            <div className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-6 text-center text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
              Día inhábil ({festivoInfo.nombre}). Selecciona otro día laborable en el calendario.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Turno Matutino (7 slots) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Turno matutino
                  </span>
                  <span className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                    09:00 – 12:00 (7 horarios)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {matutinoSlots.map((slot) => {
                    const ocupado = horasOcupadas.includes(normalizarHoraSlot(slot.hora));
                    const isResolving = resolvingHora === slot.hora;
                    return (
                      <button
                        key={slot.hora}
                        type="button"
                        disabled={ocupado || isResolving}
                        onClick={() => !ocupado && handlePickSlot(slot.hora)}
                        aria-label={
                          ocupado
                            ? `${slot.hora} horas, horario ocupado`
                            : `Seleccionar ${slot.hora} horas`
                        }
                        className={
                          ocupado
                            ? "flex h-11 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-[#6B6B6B]/20 px-3 text-sm font-medium text-[#6B6B6B] line-through tabular-nums dark:border-[#2D3F2A]"
                            : "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#1F4D2C] bg-white px-3 text-sm font-semibold text-[#1F4D2C] tabular-nums transition-colors hover:bg-[#1F4D2C] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#8FC9B5] dark:bg-[#0F1A12] dark:text-[#8FC9B5] dark:hover:bg-[#1F4D2C] dark:hover:text-white"
                        }
                      >
                        {isResolving ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Clock className="size-3.5 shrink-0" />
                        )}
                        <span>{slot.hora}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Turno Vespertino (5 slots) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Turno vespertino
                  </span>
                  <span className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                    15:00 – 17:00 (5 horarios)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {vespertinoSlots.map((slot) => {
                    const ocupado = horasOcupadas.includes(normalizarHoraSlot(slot.hora));
                    const isResolving = resolvingHora === slot.hora;
                    return (
                      <button
                        key={slot.hora}
                        type="button"
                        disabled={ocupado || isResolving}
                        onClick={() => !ocupado && handlePickSlot(slot.hora)}
                        aria-label={
                          ocupado
                            ? `${slot.hora} horas, horario ocupado`
                            : `Seleccionar ${slot.hora} horas`
                        }
                        className={
                          ocupado
                            ? "flex h-11 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-[#6B6B6B]/20 px-3 text-sm font-medium text-[#6B6B6B] line-through tabular-nums dark:border-[#2D3F2A]"
                            : "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#1F4D2C] bg-white px-3 text-sm font-semibold text-[#1F4D2C] tabular-nums transition-colors hover:bg-[#1F4D2C] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#8FC9B5] dark:bg-[#0F1A12] dark:text-[#8FC9B5] dark:hover:bg-[#1F4D2C] dark:hover:text-white"
                        }
                      >
                        {isResolving ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Clock className="size-3.5 shrink-0" />
                        )}
                        <span>{slot.hora}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {slotError && (
                <p
                  role="alert"
                  className="rounded-lg border border-[#C8102E]/30 bg-[#FEE2E2] px-3 py-2 text-xs font-medium text-[#C8102E]"
                >
                  {slotError}
                </p>
              )}

              {/* Leyenda de estados de horario */}
              <div className="flex flex-wrap items-center gap-5 border-t border-[#E5DFD3] pt-4 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3.5 w-6 rounded border border-[#1F4D2C] bg-white dark:border-[#8FC9B5] dark:bg-[#0F1A12]" />
                  Disponible
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3.5 w-6 rounded border border-[#E5DFD3] bg-[#6B6B6B]/20 dark:border-[#2D3F2A]" />
                  Ocupado
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
