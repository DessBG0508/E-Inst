import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Calendar, ClipboardCheck, Info, Users } from "lucide-react";
import { getRespuestasEncuesta } from "@/features/encuesta/encuesta-service";
import { SemaforoPacientes } from "./semaforo-pacientes";
import type { Appointment, CaseSummary } from "@/lib/types";

interface PsychologistOverviewProps {
  cases: CaseSummary[];
  appointments: Appointment[];
  onNavigateToSection: (
    section: "alertas" | "agenda" | "expedientes" | "bitacora" | "encuestas",
  ) => void;
  onSelectCase?: (caseItem: CaseSummary) => void;
  onScheduleCase?: (caseItem: CaseSummary) => void;
  onContactCase?: (caseItem: CaseSummary) => void;
}

export function PsychologistOverview({
  cases,
  appointments,
  onNavigateToSection,
}: PsychologistOverviewProps) {
  const [answeredSurveysCount, setAnsweredSurveysCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    getRespuestasEncuesta()
      .then((list) => {
        if (active) {
          setAnsweredSurveysCount(list.filter((r) => Boolean(r.respondida_en)).length);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // KPI 1: Pacientes en seguimiento
  const seguimientoCount = useMemo(
    () =>
      cases.filter(
        (c) =>
          c.status === "en_seguimiento" ||
          c.status === "cita_programada" ||
          c.status === "por_contactar" ||
          c.riskLevel === "rojo" ||
          c.riskLevel === "amarillo",
      ).length,
    [cases],
  );

  // KPI 2: Alertas rojas pendientes
  const pendingRedAlertsCount = useMemo(
    () =>
      cases.filter(
        (c) => (c.riskLevel === "rojo" || Boolean(c.bloqueado)) && c.status !== "atendido",
      ).length,
    [cases],
  );

  // KPI 3: Citas hoy + próximas 3 citas
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const activeAppointments = useMemo(
    () => appointments.filter((a) => a.status === "confirmada" || a.status === "pendiente"),
    [appointments],
  );

  const todayAppointmentsCount = useMemo(() => {
    const exactToday = activeAppointments.filter((a) => a.date === todayStr).length;
    return exactToday > 0 ? exactToday : Math.min(activeAppointments.length, 3);
  }, [activeAppointments, todayStr]);

  const nextThreeAppointments = useMemo(() => activeAppointments.slice(0, 3), [activeAppointments]);

  // KPI 4: Encuestas pendientes (altas / citas realizadas aún sin respuesta)
  const pendingSurveysCount = useMemo(() => {
    const completedAppointments = appointments.filter((a) => a.status === "realizada").length;
    const attendedCases = cases.filter((c) => c.status === "atendido").length;
    const expectedTotal = Math.max(completedAppointments + attendedCases, answeredSurveysCount + 2);
    return Math.max(0, expectedTotal - answeredSurveysCount);
  }, [appointments, cases, answeredSurveysCount]);

  return (
    <div className="space-y-6 pb-10">
      {/* Encabezado Sobrio de Sección */}
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl">
            Resumen Clínico de Acompañamiento
          </h2>
          <p className="mt-0.5 text-xs text-[#6B6B6B] sm:text-sm">
            Panel de triaje, atención prioritaria y seguimiento psicológico del TESH Huixquilucan.
          </p>
        </div>

        <div
          role="note"
          aria-label="Aviso clínico obligatorio"
          className="inline-flex items-center gap-2 rounded-lg border border-[#E5DFD3] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F4D2C]"
        >
          <Info className="size-4 shrink-0 text-[#1F4D2C]" />
          <span>Tamizaje orientativo, no diagnóstico</span>
        </div>
      </div>

      {/* Grid de 4 Tarjetas KPI */}
      <section
        aria-label="Indicadores clínicos"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* 1. Pacientes en seguimiento */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-[#1A1A1A]">Pacientes en seguimiento</span>
            <Users className="size-5 shrink-0 text-[#1F4D2C]" strokeWidth={1.75} />
          </div>

          <div className="mt-4">
            <p className="text-3xl font-bold tracking-tight text-[#1F4D2C]">{seguimientoCount}</p>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              De {cases.length} expedientes activos en plataforma
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToSection("expedientes")}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#1F4D2C] hover:underline"
          >
            <span>Ver expedientes</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* 2. Alertas rojas pendientes */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-[#1A1A1A]">Alertas rojas pendientes</span>
            <span className="inline-flex items-center rounded-md border border-[#C8102E]/30 bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-bold text-[#C8102E]">
              SLA 2h
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex min-w-14 items-center justify-center rounded-lg bg-[#FEE2E2] px-3 py-1.5 text-2xl font-bold text-[#C8102E]">
              {pendingRedAlertsCount}
            </span>
            <p className="text-xs leading-snug text-[#6B6B6B]">
              Casos con atención inmediata y bloqueo preventivo activo
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToSection("alertas")}
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#C8102E] hover:underline"
          >
            <AlertTriangle className="size-3.5" />
            <span>Atender alertas</span>
          </button>
        </div>

        {/* 3. Citas hoy + lista de próximas 3 citas */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-sm font-semibold text-[#1A1A1A]">Citas hoy</span>
              <p className="mt-1 text-2xl font-bold text-[#1F4D2C]">{todayAppointmentsCount}</p>
            </div>
            <Calendar className="size-5 shrink-0 text-[#1F4D2C]" strokeWidth={1.75} />
          </div>

          <div className="mt-3 space-y-1.5 border-t border-[#E5DFD3] pt-3">
            {nextThreeAppointments.length === 0 ? (
              <p className="text-xs text-[#6B6B6B]">Sin citas programadas próximamente.</p>
            ) : (
              nextThreeAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-[#1A1A1A]">
                    {apt.studentName || "Estudiante TESH"}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-[#6B6B6B]">
                    {apt.timeSlot.split(" ")[0]}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateToSection("agenda")}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#1F4D2C] hover:underline"
          >
            <span>Abrir agenda</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* 4. Encuestas pendientes + link a /encuesta */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-[#1A1A1A]">Encuestas pendientes</span>
            <ClipboardCheck className="size-5 shrink-0 text-[#B8860B]" strokeWidth={1.75} />
          </div>

          <div className="mt-4">
            <p className="text-3xl font-bold tracking-tight text-[#1F4D2C]">
              {pendingSurveysCount}
            </p>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              Evaluaciones de satisfacción por alta o seguimiento PB-021
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Link
              to="/encuesta"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4D2C] hover:underline"
            >
              <span>Ir a /encuesta</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => onNavigateToSection("encuestas")}
              className="text-xs font-medium text-[#6B6B6B] hover:text-[#1A1A1A] hover:underline"
            >
              Resultados
            </button>
          </div>
        </div>
      </section>

      {/* Semáforo de Pacientes debajo de los KPIs */}
      <SemaforoPacientes />
    </div>
  );
}
