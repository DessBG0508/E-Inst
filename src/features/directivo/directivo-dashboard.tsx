import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Brain,
  BedDouble,
  CircleGauge,
  BatteryMedium,
  Filter,
  BarChart3,
  PieChart,
  ChevronDown,
  Users,
  UserPlus,
  Settings,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import {
  InstitutionalSidebar,
  type InstitutionalSidebarItem,
} from "@/components/layout/institutional-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { TutoresAsignacionPanel } from "./tutores-asignacion-panel";
import { useAuth } from "@/lib/auth-context";
import {
  TESH_CAREERS,
  type TeshCareer,
  getDirectivoKPIs,
  getSemesterChartData,
} from "@/lib/directivo-data";
import { Badge } from "@/components/ui/badge";

export function DirectivoDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<"indicadores" | "tutores">("indicadores");
  const [selectedCareer, setSelectedCareer] = useState<TeshCareer | "all">(
    "Ing. en Sistemas Computacionales",
  );

  const kpis = useMemo(() => getDirectivoKPIs(selectedCareer), [selectedCareer]);
  const semesterData = useMemo(() => getSemesterChartData(selectedCareer), [selectedCareer]);

  const handleLogout = () => {
    logout();
    toast.info("Has cerrado sesión.");
    navigate({ to: "/login", replace: true });
  };

  const getCareerTitle = () => {
    if (selectedCareer === "all") return "Todas las Carreras del Campus";
    return selectedCareer;
  };

  const sidebarItems: InstitutionalSidebarItem[] = [
    {
      id: "indicadores",
      label: "Indicadores",
      icon: BarChart3,
    },
    {
      id: "tutores",
      label: "Asignar Tutores",
      icon: UserPlus,
    },
    {
      id: "auditoria",
      label: "Auditoría Blockchain",
      icon: ShieldCheck,
    },
  ];

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Dirección Académica",
      onClick: () => setActiveView("indicadores"),
    },
    {
      label: activeView === "indicadores" ? "Indicadores de Bienestar" : "Asignar Tutores",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <InstitutionalHeader
        moduleTitle={
          activeView === "indicadores"
            ? "Panel Directivo — Indicadores de Bienestar"
            : "Panel Directivo — Asignación de Tutores"
        }
        breadcrumbs={breadcrumbs}
        onHomeClick={() => setActiveView("indicadores")}
        showCrisisButton={false}
        showSidebarToggle={true}
        isSidebarOpen={isMobileSidebarOpen}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        sidebarOffsetClassName="lg:pl-64"
        actions={
          <>
            <AjustesModal
              rol="directivo"
              trigger={
                <button
                  type="button"
                  aria-label="Abrir configuración y ajustes"
                  title="Configuración y ajustes"
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Settings className="size-[18px]" strokeWidth={1.75} />
                </button>
              }
            />
            <ThemeToggle className="size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none backdrop-blur-none hover:scale-100 hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white" />
          </>
        }
      />

      <div className="flex flex-1 min-w-0">
        <InstitutionalSidebar
          items={sidebarItems}
          activeId={activeView}
          onSelect={(id) => {
            if (id === "auditoria") {
              navigate({ to: "/auditoria" });
              return;
            }
            setActiveView(id as "indicadores" | "tutores");
          }}
          ariaLabel="Navegación del panel directivo"
          sectionTitle="Dirección Académica TESH"
          systemVersion="Equilibra TESH v2.0"
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0 lg:pl-64">
          <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8 pb-16">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeView}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-6"
              >
                {activeView === "tutores" ? (
                  <TutoresAsignacionPanel />
                ) : (
                  <>
                    {/* Selector de Carrera y Control de Segmentación */}
                    <section
                      aria-labelledby="career-selector-heading"
                      className="ethereal-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="size-4 text-accent" />
                          <h2
                            id="career-selector-heading"
                            className="text-sm font-bold text-foreground uppercase tracking-wide"
                          >
                            Carrera en Análisis
                          </h2>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          En producción (RLS), cada jefatura consulta únicamente su plan académico
                          asignado.
                        </p>
                      </div>

                      <div className="w-full sm:w-auto flex flex-wrap items-center gap-2.5">
                        <label htmlFor="career-select" className="sr-only">
                          Seleccionar Carrera
                        </label>
                        <div className="relative w-full sm:w-80">
                          <select
                            id="career-select"
                            value={selectedCareer}
                            onChange={(e) =>
                              setSelectedCareer(e.target.value as TeshCareer | "all")
                            }
                            className="w-full appearance-none rounded-xl border border-border/80 bg-card px-3.5 py-2.5 pr-9 text-xs sm:text-sm font-semibold text-foreground shadow-xs transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                          >
                            <option value="all">Todas las Carreras (Vista General)</option>
                            <optgroup label="Carreras TESH">
                              {TESH_CAREERS.map((career) => (
                                <option key={career} value={career}>
                                  {career}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        </div>

                        <Badge
                          variant="outline"
                          className="border-accent/40 bg-accent/10 text-accent text-[11px] px-2.5 py-1 rounded-lg shrink-0 font-medium"
                        >
                          Demo: Segmentación Libre
                        </Badge>
                      </div>
                    </section>

                    {/* Título de Carrera y Tendencia Global */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase text-teal tracking-wider">
                          Últimos 7 días
                        </p>
                        <h2 className="font-display text-2xl sm:text-3xl font-bold text-primary">
                          {getCareerTitle()}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl bg-card border border-border/60 px-3 py-1.5 shadow-xs">
                        {kpis.weeklyTrendPercent >= 0 ? (
                          <TrendingUp className="size-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="size-4 text-amber-500" />
                        )}
                        <span className="text-xs font-bold text-foreground">
                          {kpis.weeklyTrendPercent >= 0
                            ? `+${kpis.weeklyTrendPercent}%`
                            : `${kpis.weeklyTrendPercent}%`}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          vs. semana anterior
                        </span>
                      </div>
                    </div>

                    {/* MÉTRICAS AGREGADAS PRINCIPALES PB-019: Total de Tamizados y % de Riesgo */}
                    <section
                      aria-label="Métricas agregadas principales"
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
                    >
                      {/* Total Estudiantes Tamizados */}
                      <div className="ethereal-card p-4 sm:p-5 border-l-4 border-l-primary bg-card/90">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Estudiantes Tamizados
                          </span>
                          <div className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Users className="size-4" />
                          </div>
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold text-primary">
                          {kpis.totalSamples}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Total evaluaciones anónimas procesadas
                        </p>
                      </div>

                      {/* % Nivel Verde */}
                      <div className="ethereal-card p-4 sm:p-5 border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                            Nivel Verde (Estable)
                          </span>
                          <span className="size-2.5 rounded-full bg-emerald-500" />
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                          {kpis.pctVerde}%
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Sin indicadores de alarma
                        </p>
                      </div>

                      {/* % Nivel Amarillo */}
                      <div className="ethereal-card p-4 sm:p-5 border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Nivel Amarillo (Seguimiento)
                          </span>
                          <span className="size-2.5 rounded-full bg-amber-500" />
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold text-amber-600 dark:text-amber-400">
                          {kpis.pctAmarillo}%
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Soporte y seguimiento preventivo
                        </p>
                      </div>

                      {/* % Nivel Rojo */}
                      <div className="ethereal-card p-4 sm:p-5 border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                            Nivel Rojo (Prioritario)
                          </span>
                          <div className="size-2.5 rounded-full bg-rose-500 animate-ping" />
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold text-rose-600 dark:text-rose-400">
                          {kpis.pctRojo}%
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Canalización inmediata al área clínica
                        </p>
                      </div>
                    </section>

                    {/* KPIs Agregados y Anónimos (Promedios 7 días) */}
                    <section
                      aria-label="Indicadores clave de bienestar"
                      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
                    >
                      {/* Ánimo */}
                      <div className="ethereal-card p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Ánimo Promedio
                          </span>
                          <div className="grid size-8 place-items-center rounded-xl bg-lavender-soft text-accent">
                            <Brain className="size-4" />
                          </div>
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold italic text-primary">
                          {kpis.avgAnimo.toFixed(1)}
                          <span className="font-sans text-xs font-normal not-italic text-muted-foreground ml-1">
                            / 5
                          </span>
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/25">
                          <div
                            className="h-full rounded-full bg-teal transition-all duration-700"
                            style={{ width: `${(kpis.avgAnimo / 5) * 100}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Índice agregado de percepción anímica
                        </p>
                      </div>

                      {/* Sueño */}
                      <div className="ethereal-card p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Sueño Promedio
                          </span>
                          <div className="grid size-8 place-items-center rounded-xl bg-mint-soft text-teal">
                            <BedDouble className="size-4" />
                          </div>
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold italic text-primary">
                          {kpis.avgSueno.toFixed(1)}
                          <span className="font-sans text-xs font-normal not-italic text-muted-foreground ml-1">
                            h / día
                          </span>
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/25">
                          <div
                            className="h-full rounded-full bg-teal transition-all duration-700"
                            style={{ width: `${Math.min(100, (kpis.avgSueno / 9) * 100)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Horas reportadas por los estudiantes
                        </p>
                      </div>

                      {/* Estrés */}
                      <div className="ethereal-card p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Estrés Promedio
                          </span>
                          <div className="grid size-8 place-items-center rounded-xl bg-lavender-soft text-accent">
                            <CircleGauge className="size-4" />
                          </div>
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold italic text-primary">
                          {kpis.avgEstres.toFixed(1)}
                          <span className="font-sans text-xs font-normal not-italic text-muted-foreground ml-1">
                            / 5
                          </span>
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/25">
                          <div
                            className="h-full rounded-full bg-accent transition-all duration-700"
                            style={{ width: `${(kpis.avgEstres / 5) * 100}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Nivel de sobrecarga académica percibida
                        </p>
                      </div>

                      {/* Energía */}
                      <div className="ethereal-card p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Energía Promedio
                          </span>
                          <div className="grid size-8 place-items-center rounded-xl bg-mint-soft text-teal">
                            <BatteryMedium className="size-4" />
                          </div>
                        </div>
                        <p className="font-numeric text-3xl sm:text-4xl font-bold italic text-primary">
                          {kpis.avgEnergia.toFixed(1)}
                          <span className="font-sans text-xs font-normal not-italic text-muted-foreground ml-1">
                            / 5
                          </span>
                        </p>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/25">
                          <div
                            className="h-full rounded-full bg-teal transition-all duration-700"
                            style={{ width: `${(kpis.avgEnergia / 5) * 100}%` }}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Vitalidad y disposición física
                        </p>
                      </div>
                    </section>

                    {/* Sección: Distribución de Riesgo por PORCENTAJES (Sin conteos de personas) */}
                    <section
                      aria-labelledby="risk-distribution-heading"
                      className="ethereal-card p-5 sm:p-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <PieChart className="size-4 text-teal" />
                            <h3
                              id="risk-distribution-heading"
                              className="text-base font-bold text-foreground"
                            >
                              Distribución de Riesgo Académico-Emocional
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Proporción porcentual de estados de bienestar registrados en la carrera
                            (sin conteos de personas).
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-semibold text-muted-foreground w-fit"
                        >
                          Escala Institucional TESH
                        </Badge>
                      </div>

                      {/* Barra segmentada horizontal de porcentajes */}
                      <div className="h-4 w-full overflow-hidden rounded-full bg-muted flex shadow-inner">
                        <div
                          className="bg-emerald-500 transition-all duration-700"
                          style={{ width: `${kpis.pctVerde}%` }}
                          title={`Favorable: ${kpis.pctVerde}%`}
                        />
                        <div
                          className="bg-amber-400 transition-all duration-700"
                          style={{ width: `${kpis.pctAmarillo}%` }}
                          title={`Moderado: ${kpis.pctAmarillo}%`}
                        />
                        <div
                          className="bg-rose-500 transition-all duration-700"
                          style={{ width: `${kpis.pctRojo}%` }}
                          title={`Atención prioritaria: ${kpis.pctRojo}%`}
                        />
                      </div>

                      {/* Tarjetas de Porcentaje de cada categoría (Verde / Amarillo / Rojo) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="size-2.5 rounded-full bg-emerald-500" />
                              <span className="text-xs font-bold text-foreground">
                                Favorable / Estable
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Bienestar adecuado y balance
                            </p>
                          </div>
                          <span className="font-numeric text-2xl sm:text-3xl font-bold italic text-emerald-600 dark:text-emerald-400">
                            {kpis.pctVerde}%
                          </span>
                        </div>

                        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="size-2.5 rounded-full bg-amber-400" />
                              <span className="text-xs font-bold text-foreground">
                                Seguimiento Preventivo
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Tensión o fatiga moderada
                            </p>
                          </div>
                          <span className="font-numeric text-2xl sm:text-3xl font-bold italic text-amber-600 dark:text-amber-400">
                            {kpis.pctAmarillo}%
                          </span>
                        </div>

                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="size-2.5 rounded-full bg-rose-500" />
                              <span className="text-xs font-bold text-foreground">
                                Atención Prioritaria
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Canalizado con psicología
                            </p>
                          </div>
                          <span className="font-numeric text-2xl sm:text-3xl font-bold italic text-rose-600 dark:text-rose-400">
                            {kpis.pctRojo}%
                          </span>
                        </div>
                      </div>
                    </section>

                    {/* Gráfica por Semestre (1º a 9º): Barras con promedio de bienestar */}
                    <section
                      aria-labelledby="semester-chart-heading"
                      className="ethereal-card p-5 sm:p-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                        <div>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="size-4 text-accent" />
                            <h3
                              id="semester-chart-heading"
                              className="text-base font-bold text-foreground"
                            >
                              Promedio de Bienestar por Semestre (1º a 9º)
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Comparativo anónimo del índice general de bienestar por ciclo formativo
                            (escala 1 a 5).
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[11px] font-semibold text-accent w-fit"
                        >
                          Etiquetas de semestre únicamente
                        </Badge>
                      </div>

                      <div className="h-64 sm:h-72 w-full">
                        {isMounted ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={semesterData}
                              margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                            >
                              <XAxis
                                dataKey="semesterLabel"
                                stroke="currentColor"
                                className="text-[11px] text-muted-foreground"
                                tickLine={false}
                                axisLine={{ stroke: "rgba(139, 124, 240, 0.2)" }}
                              />
                              <YAxis
                                domain={[0, 5]}
                                ticks={[1, 2, 3, 4, 5]}
                                stroke="currentColor"
                                className="text-[11px] text-muted-foreground"
                                tickLine={false}
                                axisLine={{ stroke: "rgba(139, 124, 240, 0.2)" }}
                              />
                              <Tooltip
                                cursor={{ fill: "rgba(139, 124, 240, 0.08)" }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload as {
                                      semesterLabel: string;
                                      bienestarScore: number;
                                    };
                                    return (
                                      <div className="rounded-xl border border-border/80 bg-card p-2.5 shadow-xl text-xs space-y-1">
                                        <p className="font-bold text-foreground">
                                          {data.semesterLabel} Semestre
                                        </p>
                                        <p className="text-primary font-numeric font-semibold">
                                          Índice de bienestar: {data.bienestarScore.toFixed(1)} /
                                          5.0
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          Datos agregados de la cohorte
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="bienestarScore" radius={[8, 8, 0, 0]} maxBarSize={48}>
                                {semesterData.map((entry, index) => {
                                  const score = entry.bienestarScore;
                                  const fill =
                                    score >= 4.0
                                      ? "var(--color-teal, #2BD9CF)"
                                      : score >= 3.3
                                        ? "var(--color-primary, #8B7CF0)"
                                        : "var(--color-secondary, #6857E4)";
                                  return <Cell key={`cell-${index}`} fill={fill} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground animate-pulse">
                            Cargando métricas de cohorte...
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm bg-teal" />
                          <span>Bienestar Óptimo (≥ 4.0)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm bg-primary" />
                          <span>Bienestar Estable (3.3 - 3.9)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded-sm bg-[#6857E4]" />
                          <span>Seguimiento Sugerido (&lt; 3.3)</span>
                        </span>
                      </div>
                    </section>

                    {/* Nota Visible al Pie (Privacidad y Confidencialidad Institucional) */}
                    <footer className="rounded-2xl border border-teal/40 bg-mint-soft/30 dark:bg-teal/10 p-4 sm:p-5 flex items-start gap-3.5">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal/20 text-teal mt-0.5">
                        <ShieldCheck className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-bold text-foreground">
                          Garantía de Confidencialidad Estudiantil TESH
                        </p>
                        <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground font-medium">
                          Datos agregados y anónimos. Sin acceso a nombres ni conversaciones.
                        </p>
                        <p className="text-[11px] text-muted-foreground/80">
                          La información presentada cumple con las políticas éticas universitarias
                          del Tecnológico de Estudios Superiores de Huixquilucan para la toma de
                          decisiones pedagógicas y de bienestar sin comprometer la privacidad
                          individual.
                        </p>
                      </div>
                    </footer>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
