import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  PhoneCall,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSolicitudesPsicologo } from "@/features/agenda/agenda-service";
import type { SolicitudCita } from "@/features/agenda/types";
import { TESH_CAREERS } from "@/lib/directivo-data";
import type { Appointment, CaseSummary, RiskLevel } from "@/lib/types";
import { Button } from "@/components/ui/button";

const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;

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

interface ParaPsicologoRow {
  folio: string;
  iniciales?: string | null;
  nombre?: string | null;
  matricula?: string | null;
  semestre?: string | number | null;
  carrera?: string | null;
  ultimo_nivel?: string | null;
  gad7_total?: number | null;
  phq9_total?: number | null;
  bloqueado?: boolean | null;
  tiene_alerta_activa?: boolean | null;
  ultimo_tamizaje?: string | null;
  alertas_pendientes?: number | null;
}

interface AlertaRow {
  id: string;
  folio?: string | null;
  tipo?: string | null;
  mensaje?: string | null;
  atendida?: boolean | null;
  created_at?: string | null;
}

interface CheckinRow {
  escala: number;
  creado_en: string;
}

const RISK_COLORS = {
  rojo: "#C8102E",
  amarillo: "#B8860B",
  verde: "#1F4D2C",
} as const;

const CAREER_SHORT_LABELS: Record<string, string> = {
  "Ing. Civil": "Ing. Civil",
  "Ing. Industrial": "Ing. Industrial",
  "Ing. Mecatrónica": "Ing. Mecatrónica",
  "Ing. en Sistemas Computacionales": "Ing. Sistemas",
  "Lic. en Administración": "Lic. Administración",
  "Lic. en Biología": "Lic. Biología",
  "Lic. en Gastronomía": "Lic. Gastronomía",
};

const FALLBACK_WELLBEING_WEEK = [
  { day: "Lun", promedio: 3.6 },
  { day: "Mar", promedio: 3.4 },
  { day: "Mié", promedio: 3.7 },
  { day: "Jue", promedio: 3.9 },
  { day: "Vie", promedio: 4.1 },
  { day: "Sáb", promedio: 4.2 },
  { day: "Dom", promedio: 4.0 },
];

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDERED_WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function normalizeRisk(raw?: string | null): RiskLevel {
  const lower = (raw || "").toLowerCase();
  if (lower === "rojo") return "rojo";
  if (lower === "amarillo") return "amarillo";
  return "verde";
}

function getInitials(name?: string | null, fallback?: string | null): string {
  if (fallback && fallback.trim()) {
    return fallback.replace(/\./g, "").trim().slice(0, 2).toUpperCase();
  }
  if (name && name.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return "ES";
}

function formatShortDate(raw?: string | null): string {
  if (!raw) return "Reciente";
  try {
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return raw;
    return format(parsed, "dd MMM, HH:mm", { locale: es });
  } catch {
    return raw;
  }
}

function normalizeCareer(raw?: string | null): string {
  const clean = (raw || "").trim().toLowerCase();
  if (!clean) return "Ing. en Sistemas Computacionales";
  if (clean.includes("sistemas")) return "Ing. en Sistemas Computacionales";
  if (clean.includes("industrial")) return "Ing. Industrial";
  if (clean.includes("civil")) return "Ing. Civil";
  if (clean.includes("mecatr")) return "Ing. Mecatrónica";
  if (clean.includes("admin")) return "Lic. en Administración";
  if (clean.includes("biolog")) return "Lic. en Biología";
  if (clean.includes("gastronom")) return "Lic. en Gastronomía";
  return "Ing. en Sistemas Computacionales";
}

export function PsychologistOverview({
  cases,
  appointments,
  onNavigateToSection,
  onSelectCase,
  onContactCase,
}: PsychologistOverviewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [dbPatients, setDbPatients] = useState<ParaPsicologoRow[] | null>(null);
  const [dbAlerts, setDbAlerts] = useState<AlertaRow[] | null>(null);
  const [dbSolicitudes, setDbSolicitudes] = useState<SolicitudCita[] | null>(null);
  const [dbCheckins, setDbCheckins] = useState<CheckinRow[] | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [patientsRes, alertsRes, solicitudesRes, checkinsRes] = await Promise.allSettled([
        supabase.from("para_psicologo").select("*").order("ultimo_nivel"),
        supabase
          .from("alertas")
          .select("id, folio, tipo, mensaje, atendida, created_at")
          .eq("atendida", false)
          .order("created_at", { ascending: false })
          .limit(20),
        getSolicitudesPsicologo(),
        supabase
          .from("checkins")
          .select("escala, creado_en")
          .gte("creado_en", sevenDaysAgo.toISOString())
          .order("creado_en", { ascending: true }),
      ]);

      if (!active) return;

      if (
        patientsRes.status === "fulfilled" &&
        !patientsRes.value.error &&
        Array.isArray(patientsRes.value.data) &&
        (USE_LIVE_SUPABASE || patientsRes.value.data.length > 0)
      ) {
        setDbPatients(patientsRes.value.data as ParaPsicologoRow[]);
      }

      if (
        alertsRes.status === "fulfilled" &&
        !alertsRes.value.error &&
        Array.isArray(alertsRes.value.data)
      ) {
        setDbAlerts(alertsRes.value.data as AlertaRow[]);
      }

      if (solicitudesRes.status === "fulfilled" && Array.isArray(solicitudesRes.value)) {
        setDbSolicitudes(solicitudesRes.value);
      }

      if (
        checkinsRes.status === "fulfilled" &&
        !checkinsRes.value.error &&
        Array.isArray(checkinsRes.value.data) &&
        (USE_LIVE_SUPABASE || checkinsRes.value.data.length > 0)
      ) {
        setDbCheckins(checkinsRes.value.data as CheckinRow[]);
      }
    }

    loadDashboardData();

    return () => {
      active = false;
    };
  }, []);

  // Lista unificada de pacientes (Supabase para_psicologo en vivo; fallback a store solo en DEMO_MODE)
  const unifiedCases = useMemo<CaseSummary[]>(() => {
    if (USE_LIVE_SUPABASE) {
      if (dbPatients === null) return cases;
      return dbPatients.map((row, idx) => {
        const risk = normalizeRisk(row.ultimo_nivel);
        return {
          id: row.folio || `db-case-${idx}`,
          initials: getInitials(row.nombre, row.iniciales),
          studentName: row.nombre || `Estudiante ${row.iniciales || row.folio}`,
          matricula: row.matricula || row.folio,
          career: normalizeCareer(row.carrera),
          semester: row.semestre ? `${row.semestre}` : "Semestre s/d",
          riskLevel: risk,
          status: row.bloqueado ? "por_contactar" : "en_seguimiento",
          summary: `GAD-7: ${row.gad7_total ?? 0} · PHQ-9: ${row.phq9_total ?? 0}`,
          lastCheckIn: row.ultimo_tamizaje || new Date().toISOString(),
          accompanimentSummary: "Seguimiento institucional",
          phq9: row.phq9_total ?? 0,
          gad7: row.gad7_total ?? 0,
          bloqueado: Boolean(row.bloqueado),
        };
      });
    }

    if (dbPatients && dbPatients.length > 0) {
      return dbPatients.map((row, idx) => {
        const risk = normalizeRisk(row.ultimo_nivel);
        const existingLocal = cases.find(
          (c) => c.matricula === row.matricula || c.id === row.folio,
        );
        return {
          id: existingLocal?.id || row.folio || `db-case-${idx}`,
          initials: getInitials(row.nombre, row.iniciales),
          studentName: row.nombre || `Estudiante ${row.iniciales || row.folio}`,
          matricula: row.matricula || row.folio,
          career: normalizeCareer(row.carrera),
          semester: row.semestre ? `${row.semestre}` : existingLocal?.semester || "5º Semestre",
          riskLevel: risk,
          status: existingLocal?.status || (row.bloqueado ? "por_contactar" : "en_seguimiento"),
          summary: `GAD-7: ${row.gad7_total ?? 0} · PHQ-9: ${row.phq9_total ?? 0}`,
          lastCheckIn:
            row.ultimo_tamizaje || existingLocal?.lastCheckIn || new Date().toISOString(),
          accompanimentSummary: existingLocal?.accompanimentSummary || "Seguimiento institucional",
          phq9: row.phq9_total ?? existingLocal?.phq9,
          gad7: row.gad7_total ?? existingLocal?.gad7,
          bloqueado: Boolean(row.bloqueado),
        };
      });
    }
    return cases;
  }, [dbPatients, cases]);

  // Distribución de casos por riesgo
  const riskCounts = useMemo(() => {
    let rojo = 0;
    let amarillo = 0;
    let verde = 0;
    for (const item of unifiedCases) {
      if (item.riskLevel === "rojo") rojo += 1;
      else if (item.riskLevel === "amarillo") amarillo += 1;
      else verde += 1;
    }
    return { rojo, amarillo, verde, total: unifiedCases.length };
  }, [unifiedCases]);

  // KPI 1: Alertas sin resolver
  const unresolvedAlertsCount = useMemo(() => {
    const activeFromCases = unifiedCases.filter(
      (c) => (c.riskLevel === "rojo" || Boolean(c.bloqueado)) && c.status !== "atendido",
    ).length;
    if (dbAlerts && dbAlerts.length > 0) {
      return Math.max(dbAlerts.length, activeFromCases);
    }
    return activeFromCases;
  }, [dbAlerts, unifiedCases]);

  // KPI 2 & 3: Citas y Casos atendidos hoy
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const upcomingAppointments = useMemo(() => {
    if (USE_LIVE_SUPABASE && dbSolicitudes !== null) {
      return dbSolicitudes
        .filter((s) => s.estado === "confirmada" || s.estado === "pendiente")
        .sort((a, b) =>
          `${a.fecha_cita} ${a.hora_cita}`.localeCompare(`${b.fecha_cita} ${b.hora_cita}`),
        )
        .map((s) => ({
          id: s.id,
          name: s.iniciales_estudiante ? `Est. ${s.iniciales_estudiante}` : s.folio,
          hora: (s.hora_cita || "").slice(0, 5),
        }));
    }

    if (dbSolicitudes && dbSolicitudes.length > 0) {
      return dbSolicitudes
        .filter((s) => s.estado === "confirmada" || s.estado === "pendiente")
        .sort((a, b) =>
          `${a.fecha_cita} ${a.hora_cita}`.localeCompare(`${b.fecha_cita} ${b.hora_cita}`),
        )
        .map((s) => ({
          id: s.id,
          name: s.iniciales_estudiante ? `Est. ${s.iniciales_estudiante}` : s.folio,
          hora: (s.hora_cita || "").slice(0, 5),
        }));
    }
    return appointments
      .filter((a) => a.status === "confirmada" || a.status === "pendiente")
      .map((a) => ({
        id: a.id,
        name: a.studentName || "Estudiante TESH",
        hora: (a.timeSlot || "").split(" ")[0],
      }));
  }, [dbSolicitudes, appointments]);

  const casesTodayCount = useMemo(() => {
    if (USE_LIVE_SUPABASE) {
      if (dbSolicitudes === null) return 0;
      const completedToday = dbSolicitudes.filter(
        (s) => s.estado === "completada" && s.fecha_cita === todayStr,
      ).length;
      if (completedToday > 0) return completedToday;
      return dbSolicitudes.filter((s) => s.estado === "completada").length;
    }

    if (dbSolicitudes && dbSolicitudes.length > 0) {
      const completedToday = dbSolicitudes.filter(
        (s) => s.estado === "completada" && s.fecha_cita === todayStr,
      ).length;
      if (completedToday > 0) return completedToday;
      const completedTotal = dbSolicitudes.filter((s) => s.estado === "completada").length;
      return completedTotal > 0
        ? completedTotal
        : cases.filter((c) => c.status === "atendido").length;
    }
    const localDone = appointments.filter(
      (a) => a.status === "realizada" && a.date === todayStr,
    ).length;
    return localDone > 0
      ? localDone
      : Math.max(cases.filter((c) => c.status === "atendido").length, 2);
  }, [dbSolicitudes, appointments, cases, todayStr]);

  // Datos Donut Chart (Distribución de riesgo)
  const donutData = useMemo(() => {
    const total = Math.max(riskCounts.total, 1);
    return [
      {
        key: "rojo",
        name: "Alto riesgo",
        value: riskCounts.rojo,
        pct: Math.round((riskCounts.rojo / total) * 100),
        color: RISK_COLORS.rojo,
      },
      {
        key: "amarillo",
        name: "Seguimiento",
        value: riskCounts.amarillo,
        pct: Math.round((riskCounts.amarillo / total) * 100),
        color: RISK_COLORS.amarillo,
      },
      {
        key: "verde",
        name: "Estable",
        value: riskCounts.verde,
        pct: Math.round((riskCounts.verde / total) * 100),
        color: RISK_COLORS.verde,
      },
    ];
  }, [riskCounts]);

  // Datos Tendencia de bienestar (7 días)
  const wellbeingTrend = useMemo(() => {
    if (!dbCheckins || dbCheckins.length === 0) {
      if (USE_LIVE_SUPABASE) {
        return ORDERED_WEEKDAYS.map((day) => ({ day, promedio: 0 }));
      }
      return FALLBACK_WELLBEING_WEEK;
    }

    const buckets: Record<string, { sum: number; count: number }> = {};
    for (const day of ORDERED_WEEKDAYS) {
      buckets[day] = { sum: 0, count: 0 };
    }

    for (const row of dbCheckins) {
      const d = new Date(row.creado_en);
      if (!isNaN(d.getTime())) {
        const label = WEEKDAY_LABELS[d.getDay()];
        if (buckets[label]) {
          buckets[label].sum += Number(row.escala) || 3;
          buckets[label].count += 1;
        }
      }
    }

    return ORDERED_WEEKDAYS.map((day, idx) => {
      const b = buckets[day];
      const emptyVal = USE_LIVE_SUPABASE ? 0 : (FALLBACK_WELLBEING_WEEK[idx]?.promedio ?? 3.8);
      return {
        day,
        promedio: b && b.count > 0 ? Number((b.sum / b.count).toFixed(1)) : emptyVal,
      };
    });
  }, [dbCheckins]);

  const wellbeingAverage = useMemo(() => {
    if (USE_LIVE_SUPABASE) {
      const withData = wellbeingTrend.filter((item) => item.promedio > 0);
      if (withData.length === 0) return 0;
      const sum = withData.reduce((acc, item) => acc + item.promedio, 0);
      return Number((sum / withData.length).toFixed(1));
    }

    if (wellbeingTrend.length === 0) return 0;
    const sum = wellbeingTrend.reduce((acc, item) => acc + item.promedio, 0);
    return Number((sum / wellbeingTrend.length).toFixed(1));
  }, [wellbeingTrend]);

  // Datos Bar Chart horizontal por las 7 carreras TESH
  const careerChartData = useMemo(() => {
    const map = new Map<
      string,
      { career: string; shortName: string; rojo: number; amarillo: number; verde: number }
    >();

    for (const career of TESH_CAREERS) {
      map.set(career, {
        career,
        shortName: CAREER_SHORT_LABELS[career] || career,
        rojo: 0,
        amarillo: 0,
        verde: 0,
      });
    }

    for (const c of unifiedCases) {
      const normalized = normalizeCareer(c.career);
      const entry = map.get(normalized);
      if (entry) {
        if (c.riskLevel === "rojo") entry.rojo += 1;
        else if (c.riskLevel === "amarillo") entry.amarillo += 1;
        else entry.verde += 1;
      }
    }

    return Array.from(map.values());
  }, [unifiedCases]);

  // Lista de las últimas 5 alertas críticas (rojas)
  const recentRedAlerts = useMemo(() => {
    const redCases = unifiedCases.filter((c) => c.riskLevel === "rojo");
    const mapped = redCases.map((c) => ({
      id: c.id,
      initials: getInitials(c.studentName, c.initials),
      studentName: c.studentName || `Estudiante ${c.initials}`,
      dateLabel: formatShortDate(c.lastCheckIn),
      caseItem: c,
    }));

    if (dbAlerts && dbAlerts.length > 0) {
      const seenIds = new Set(mapped.map((m) => m.id));
      for (const al of dbAlerts) {
        const key = al.folio || al.id;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          mapped.unshift({
            id: key,
            initials: getInitials(al.folio, "AL"),
            studentName: al.folio ? `Caso ${al.folio}` : "Alerta prioritaria",
            dateLabel: formatShortDate(al.created_at),
            caseItem: {
              id: key,
              initials: getInitials(al.folio, "AL"),
              studentName: al.folio ? `Caso ${al.folio}` : "Estudiante TESH",
              matricula: al.folio || "",
              career: "Comunidad TESH",
              semester: "",
              riskLevel: "rojo",
              status: "por_contactar",
              summary: al.mensaje || "Alerta clínica prioritaria",
              lastCheckIn: al.created_at || new Date().toISOString(),
              accompanimentSummary: "Alerta activa",
            },
          });
        }
      }
    }

    return mapped.slice(0, 5);
  }, [unifiedCases, dbAlerts]);

  return (
    <div className="space-y-6 bg-[#F5F1E8] pb-10 dark:bg-transparent">
      {/* Encabezado limpio */}
      <div className="flex flex-col gap-2 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1F4D2C] sm:text-2xl dark:text-[#8FC9B5]">
            Resumen Clínico de Acompañamiento
          </h2>
          <p className="mt-0.5 text-xs text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
            Indicadores de triaje, bienestar estudiantil y alertas prioritarias del TESH.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateToSection("alertas")}
          className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3.5 text-xs font-semibold text-[#1F4D2C] transition-colors hover:bg-[#E0F0E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5] dark:hover:bg-[#1F4D2C]/30"
        >
          <span>Ir al semáforo completo</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      {/* =================================================================== */}
      {/* 1. FILA SUPERIOR — 4 KPI CARDS                                      */}
      {/* =================================================================== */}
      <section
        aria-label="Indicadores clínicos clave"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {/* KPI 1: Alertas sin resolver */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-[#FEE2E2]/40 p-5 dark:border-[#2D3F2A] dark:bg-[#3B1219]/40">
          <div className="flex items-start justify-between gap-2">
            {unresolvedAlertsCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-[#C8102E] px-2.5 py-0.5 text-[11px] font-bold text-white">
                SLA 2h
              </span>
            ) : (
              <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                Prioridad
              </span>
            )}
            <AlertTriangle className="size-5 shrink-0 text-[#C8102E]" strokeWidth={1.75} />
          </div>

          <div className="mt-4">
            <p className="text-4xl font-bold tracking-tight text-[#C8102E] tabular-nums">
              {unresolvedAlertsCount}
            </p>
            <p className="mt-1 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Alertas sin resolver
            </p>
          </div>
        </div>

        {/* KPI 2: Casos hoy */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
              Jornada actual
            </span>
            <ClipboardCheck
              className="size-5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
              strokeWidth={1.75}
            />
          </div>

          <div className="mt-4">
            <p className="text-4xl font-bold tracking-tight text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
              {casesTodayCount}
            </p>
            <p className="mt-1 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Casos atendidos hoy
            </p>
          </div>
        </div>

        {/* KPI 3: Próximas citas + lista compacta de 3 citas */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-4xl font-bold tracking-tight text-[#B8860B] tabular-nums dark:text-[#D4A82B]">
                {upcomingAppointments.length}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                Próximas citas
              </p>
            </div>
            <Calendar
              className="size-5 shrink-0 text-[#B8860B] dark:text-[#D4A82B]"
              strokeWidth={1.75}
            />
          </div>

          <div className="mt-3 space-y-1 border-t border-[#E5DFD3] pt-2.5 dark:border-[#2D3F2A]">
            {upcomingAppointments.length === 0 ? (
              <p className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">Sin citas próximas</p>
            ) : (
              upcomingAppointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {apt.name}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                    {apt.hora}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* KPI 4: Casos por riesgo (3 mini-pills horizontales) */}
        <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
            Casos por riesgo
          </span>

          <div className="my-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C8102E] px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
              <span className="font-bold">{riskCounts.rojo}</span>
              <span>Rojo</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#B8860B] px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
              <span className="font-bold">{riskCounts.amarillo}</span>
              <span>Amarillo</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1F4D2C] px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
              <span className="font-bold">{riskCounts.verde}</span>
              <span>Verde</span>
            </span>
          </div>

          <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            Distribución de casos
          </p>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. SEGUNDA FILA — 2 GRÁFICAS LADO A LADO (DONUT + LINE/AREA)        */}
      {/* =================================================================== */}
      <section
        aria-label="Gráficas de riesgo y tendencia emocional"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {/* GRÁFICA 1: Distribución de riesgo (Donut Chart) */}
        <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
              Distribución de riesgo
            </h3>
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Semáforo clínico
            </span>
          </div>

          <div className="relative h-60 w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} casos`, name]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5DFD3",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                {riskCounts.total}
              </span>
              <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                casos totales
              </span>
            </div>
          </div>

          {/* Leyenda debajo con porcentajes y colores */}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#E5DFD3] pt-4 dark:border-[#2D3F2A]">
            {donutData.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {item.name}
                  </p>
                  <p className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                    {item.value} ({item.pct}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* GRÁFICA 2: Tendencia de bienestar (7 días) */}
        <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                Tendencia de bienestar (7 días)
              </h3>
              <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                Promedio diario de check-ins emocionales (escala 1 a 5)
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold leading-none text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                {wellbeingAverage.toFixed(1)}
              </p>
              <span className="text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                Promedio / 5.0
              </span>
            </div>
          </div>

          <div className="h-64 w-full [&_.recharts-cartesian-axis-tick_text]:fill-[#6B6B6B] dark:[&_.recharts-cartesian-axis-tick_text]:fill-[#A6B5A3] [&_.recharts-cartesian-grid_line]:stroke-[#E5DFD3] dark:[&_.recharts-cartesian-grid_line]:stroke-[#2D3F2A]">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={wellbeingTrend}
                  margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} / 5.0`, "Bienestar"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5DFD3",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="promedio"
                    stroke="#1F4D2C"
                    strokeWidth={2.5}
                    fill="#1F4D2C"
                    fillOpacity={0.12}
                    dot={{ r: 4, fill: "#1F4D2C", stroke: "#FFFFFF", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#1F4D2C" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      {/* =================================================================== */}
      {/* 3. TERCERA FILA — CASOS POR CARRERA (60%) + ALERTAS CRÍTICAS (40%)  */}
      {/* =================================================================== */}
      <section
        aria-label="Desglose por carrera y alertas críticas recientes"
        className="grid grid-cols-1 gap-6 lg:grid-cols-5"
      >
        {/* ELEM 1 (60% -> 3/5): Casos por carrera (Bar Chart horizontal) */}
        <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-3 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                Casos por carrera
              </h3>
              <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                Segmentación de las 7 carreras del TESH por nivel de riesgo
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-[#C8102E]" />
                Rojo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-[#B8860B]" />
                Amarillo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-[#1F4D2C]" />
                Verde
              </span>
            </div>
          </div>

          <div className="h-[300px] w-full [&_.recharts-cartesian-axis-tick_text]:fill-[#1A1A1A] dark:[&_.recharts-cartesian-axis-tick_text]:fill-[#F5F1E8] [&_.recharts-cartesian-grid_line]:stroke-[#E5DFD3] dark:[&_.recharts-cartesian-grid_line]:stroke-[#2D3F2A]">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={careerChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={132}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5DFD3",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="rojo"
                    name="Alto riesgo"
                    stackId="riesgo"
                    fill={RISK_COLORS.rojo}
                    barSize={18}
                  />
                  <Bar
                    dataKey="amarillo"
                    name="Seguimiento"
                    stackId="riesgo"
                    fill={RISK_COLORS.amarillo}
                    barSize={18}
                  />
                  <Bar
                    dataKey="verde"
                    name="Estable"
                    stackId="riesgo"
                    fill={RISK_COLORS.verde}
                    barSize={18}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        {/* ELEM 2 (40% -> 2/5): Alertas críticas recientes */}
        <article className="flex flex-col rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-2 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-[#C8102E] dark:text-[#FCA5A5]">
              Alertas críticas recientes
            </h3>
            <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-xs font-bold text-[#C8102E] tabular-nums dark:bg-[#3B1219] dark:text-[#FCA5A5]">
              {recentRedAlerts.length}
            </span>
          </div>

          {recentRedAlerts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-6 text-center dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
              <CheckCircle2
                className="size-9 text-[#1F4D2C] dark:text-[#8FC9B5]"
                strokeWidth={1.75}
              />
              <p className="mt-2.5 text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                No hay alertas críticas
              </p>
              <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                Todos los casos prioritarios han sido atendidos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
              {recentRedAlerts.map((alert) => (
                <li key={alert.id} className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2] text-xs font-bold text-[#C8102E] dark:bg-[#3B1219] dark:text-[#FCA5A5]">
                        {alert.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {alert.studentName}
                        </p>
                        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {alert.dateLabel}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full bg-[#C8102E] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      Alto
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onSelectCase
                          ? onSelectCase(alert.caseItem)
                          : onNavigateToSection("expedientes")
                      }
                      className="h-8 cursor-pointer px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:text-[#8FC9B5] dark:hover:bg-[#0F1A12]"
                    >
                      Ver expediente
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        onContactCase
                          ? onContactCase(alert.caseItem)
                          : onNavigateToSection("alertas")
                      }
                      className="h-8 cursor-pointer gap-1.5 rounded-lg bg-[#1F4D2C] px-3 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                    >
                      <PhoneCall className="size-3.5" strokeWidth={1.75} />
                      <span>Contactar</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
