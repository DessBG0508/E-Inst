import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Star, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DIRECTIVO_MOCK_RECORDS,
  TESH_CAREERS,
  getDirectivoKPIs,
  getSemesterChartData,
  type SemesterBarData,
  type TeshCareer,
} from "@/lib/directivo-data";
import { DEMO_MODE } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSolicitudesPsicologo } from "@/features/agenda/agenda-service";
import {
  calcularMetricasEncuesta,
  getRespuestasEncuesta,
} from "@/features/encuesta/encuesta-service";
import { supabase } from "@/integrations/supabase/client";

const USE_LIVE_SUPABASE = !DEMO_MODE && isSupabaseConfigured;

const SEMAFORO_COLORS = {
  rojo: "#C8102E",
  amarillo: "#B8860B",
  verde: "#1F4D2C",
} as const;

interface CitaRateMetrics {
  completadas: number;
  noAsistio: number;
  tasaCompletadas: number;
  tasaNoAsistio: number;
}

interface AnonymousSemaforoRow {
  ultimo_nivel: string | null;
  carrera: string | null;
  semestre: string | number | null;
}

function normalizeTeshCareer(raw?: string | null): TeshCareer | null {
  const clean = (raw || "").trim().toLowerCase();
  if (!clean) return null;
  if (clean.includes("sistemas")) return "Ing. en Sistemas Computacionales";
  if (clean.includes("industrial")) return "Ing. Industrial";
  if (clean.includes("civil")) return "Ing. Civil";
  if (clean.includes("mecatr")) return "Ing. Mecatrónica";
  if (clean.includes("admin")) return "Lic. en Administración";
  if (clean.includes("biolog")) return "Lic. en Biología";
  if (clean.includes("gastronom")) return "Lic. en Gastronomía";
  return null;
}

function parseSemesterNumber(raw?: string | number | null): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw >= 1 && raw <= 9 ? Math.trunc(raw) : null;
  }
  if (typeof raw === "string") {
    const match = raw.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      return n >= 1 && n <= 9 ? n : null;
    }
  }
  return null;
}

export function DirectivoResumenEjecutivo() {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedCareer, setSelectedCareer] = useState<TeshCareer | "all">("all");
  const [totalTamizadosDb, setTotalTamizadosDb] = useState<number | null>(
    USE_LIVE_SUPABASE ? 0 : null,
  );
  const [liveSemaforoRows, setLiveSemaforoRows] = useState<AnonymousSemaforoRow[]>([]);
  const [citasMetrics, setCitasMetrics] = useState<CitaRateMetrics>(
    USE_LIVE_SUPABASE
      ? { completadas: 0, noAsistio: 0, tasaCompletadas: 0, tasaNoAsistio: 0 }
      : { completadas: 78, noAsistio: 22, tasaCompletadas: 78, tasaNoAsistio: 22 },
  );
  const [pb021Metrics, setPb021Metrics] = useState(
    USE_LIVE_SUPABASE
      ? { promedio: 0, totalRespondidas: 0, tasaRespuesta: 0 }
      : { promedio: 4.4, totalRespondidas: 5, tasaRespuesta: 100 },
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAggregates() {
      // 1. Conteo agregado anónimo de tamizajes
      try {
        const { count, error } = await supabase
          .from("respuestas_tamizaje")
          .select("id", { count: "exact", head: true });
        if (active && !error && typeof count === "number") {
          if (USE_LIVE_SUPABASE || count > 0) {
            setTotalTamizadosDb(count);
          }
        }
      } catch {
        // Sin cambio en demo; en vivo permanece en 0
      }

      // 1b. Distribución anónima de semáforo por carrera y semestre (sin datos personales)
      if (USE_LIVE_SUPABASE) {
        try {
          const { data, error } = await supabase
            .from("para_psicologo")
            .select("ultimo_nivel, carrera, semestre");
          if (active && !error && Array.isArray(data)) {
            setLiveSemaforoRows(data as AnonymousSemaforoRow[]);
          }
        } catch {
          if (active) setLiveSemaforoRows([]);
        }
      }

      // 2. Tasa agregada de citas completadas vs no_asistio
      try {
        const citas = await getSolicitudesPsicologo();
        const completadasCount = citas.filter((c) => c.estado === "completada").length;
        const noAsistioCount = citas.filter((c) => c.estado === "no_asistio").length;
        const baseTotal = completadasCount + noAsistioCount;

        if (active && (USE_LIVE_SUPABASE || baseTotal > 0)) {
          const pctComp = baseTotal > 0 ? Math.round((completadasCount / baseTotal) * 100) : 0;
          const pctNo = baseTotal > 0 ? Math.max(0, 100 - pctComp) : 0;
          setCitasMetrics({
            completadas: completadasCount,
            noAsistio: noAsistioCount,
            tasaCompletadas: pctComp,
            tasaNoAsistio: pctNo,
          });
        }
      } catch {
        // Sin cambio en demo; en vivo permanece en 0
      }

      // 3. Promedio de satisfacción PB-021
      try {
        const respuestas = await getRespuestasEncuesta();
        const calc = calcularMetricasEncuesta(respuestas);
        if (active && (USE_LIVE_SUPABASE || calc.totalRespondidas > 0)) {
          setPb021Metrics({
            promedio: calc.promedioGeneral,
            totalRespondidas: calc.totalRespondidas,
            tasaRespuesta: calc.tasaRespuesta,
          });
        }
      } catch {
        // Sin cambio en demo; en vivo permanece en 0
      }
    }

    loadAggregates();
    return () => {
      active = false;
    };
  }, []);

  const filteredLiveRows = useMemo(() => {
    if (!USE_LIVE_SUPABASE) return [];
    if (selectedCareer === "all") return liveSemaforoRows;
    return liveSemaforoRows.filter((r) => normalizeTeshCareer(r.carrera) === selectedCareer);
  }, [liveSemaforoRows, selectedCareer]);

  const kpis = useMemo(() => {
    if (!USE_LIVE_SUPABASE) {
      return getDirectivoKPIs(selectedCareer);
    }

    const total = filteredLiveRows.length;
    if (total === 0) {
      return {
        avgAnimo: 0,
        avgSueno: 0,
        avgEstres: 0,
        avgEnergia: 0,
        pctVerde: 0,
        pctAmarillo: 0,
        pctRojo: 0,
        weeklyTrendPercent: 0,
        totalSamples: 0,
      };
    }

    const countVerde = filteredLiveRows.filter(
      (r) => (r.ultimo_nivel || "").toLowerCase() === "verde",
    ).length;
    const countAmarillo = filteredLiveRows.filter(
      (r) => (r.ultimo_nivel || "").toLowerCase() === "amarillo",
    ).length;

    const pctVerde = Math.round((countVerde / total) * 100);
    const pctAmarillo = Math.round((countAmarillo / total) * 100);
    const pctRojo = Math.max(0, 100 - pctVerde - pctAmarillo);

    return {
      avgAnimo: 0,
      avgSueno: 0,
      avgEstres: 0,
      avgEnergia: 0,
      pctVerde,
      pctAmarillo,
      pctRojo,
      weeklyTrendPercent: 0,
      totalSamples: total,
    };
  }, [selectedCareer, filteredLiveRows]);

  const semesterData = useMemo<SemesterBarData[]>(() => {
    if (!USE_LIVE_SUPABASE) {
      return getSemesterChartData(selectedCareer);
    }

    const semesters: SemesterBarData[] = [];
    for (let s = 1; s <= 9; s++) {
      const semRows = filteredLiveRows.filter((r) => parseSemesterNumber(r.semestre) === s);
      if (semRows.length > 0) {
        const avgScore =
          semRows.reduce((acc, r) => {
            const nivel = (r.ultimo_nivel || "").toLowerCase();
            if (nivel === "rojo") return acc + 1.5;
            if (nivel === "amarillo") return acc + 3.0;
            return acc + 4.5;
          }, 0) / semRows.length;
        semesters.push({
          semesterLabel: `${s}º`,
          semesterNum: s,
          bienestarScore: Math.round(avgScore * 10) / 10,
          hasData: true,
        });
      } else {
        semesters.push({
          semesterLabel: `${s}º`,
          semesterNum: s,
          bienestarScore: 0,
          hasData: false,
        });
      }
    }
    return semesters;
  }, [selectedCareer, filteredLiveRows]);

  const totalTamizadosDisplay = useMemo(() => {
    if (USE_LIVE_SUPABASE) {
      if (selectedCareer === "all") {
        return Math.max(totalTamizadosDb ?? 0, liveSemaforoRows.length);
      }
      return kpis.totalSamples;
    }

    if (selectedCareer === "all" && totalTamizadosDb !== null) {
      return totalTamizadosDb;
    }
    return kpis.totalSamples;
  }, [selectedCareer, totalTamizadosDb, kpis.totalSamples, liveSemaforoRows.length]);

  const semaforoDonutData = useMemo(
    () => [
      { name: "Rojo", value: kpis.pctRojo, color: SEMAFORO_COLORS.rojo },
      { name: "Amarillo", value: kpis.pctAmarillo, color: SEMAFORO_COLORS.amarillo },
      { name: "Verde", value: kpis.pctVerde, color: SEMAFORO_COLORS.verde },
    ],
    [kpis.pctRojo, kpis.pctAmarillo, kpis.pctVerde],
  );

  const citasBarData = useMemo(
    () => [
      {
        estado: "Completadas",
        porcentaje: citasMetrics.tasaCompletadas,
        conteo: citasMetrics.completadas,
        fill: "#1F4D2C",
      },
      {
        estado: "No asistió",
        porcentaje: citasMetrics.tasaNoAsistio,
        conteo: citasMetrics.noAsistio,
        fill: "#C8102E",
      },
    ],
    [citasMetrics],
  );

  const careerBreakdown = useMemo(() => {
    if (USE_LIVE_SUPABASE) {
      return TESH_CAREERS.map((career) => {
        const records = liveSemaforoRows.filter((r) => normalizeTeshCareer(r.carrera) === career);
        const total = records.length;
        const verde = records.filter(
          (r) => (r.ultimo_nivel || "").toLowerCase() === "verde",
        ).length;
        const amarillo = records.filter(
          (r) => (r.ultimo_nivel || "").toLowerCase() === "amarillo",
        ).length;
        const pctVerde = total > 0 ? Math.round((verde / total) * 100) : 0;
        const pctAmarillo = total > 0 ? Math.round((amarillo / total) * 100) : 0;
        const pctRojo = total > 0 ? Math.max(0, 100 - pctVerde - pctAmarillo) : 0;

        return {
          career,
          total,
          pctVerde,
          pctAmarillo,
          pctRojo,
        };
      });
    }

    return TESH_CAREERS.map((career) => {
      const records = DIRECTIVO_MOCK_RECORDS.filter((r) => r.career === career);
      const total = records.length;
      const verde = records.filter((r) => r.riskLevel === "verde").length;
      const amarillo = records.filter((r) => r.riskLevel === "amarillo").length;
      const pctVerde = total > 0 ? Math.round((verde / total) * 100) : 0;
      const pctAmarillo = total > 0 ? Math.round((amarillo / total) * 100) : 0;
      const pctRojo = total > 0 ? Math.max(0, 100 - pctVerde - pctAmarillo) : 0;

      return {
        career,
        total,
        pctVerde,
        pctAmarillo,
        pctRojo,
      };
    });
  }, [liveSemaforoRows]);

  return (
    <div className="space-y-6">
      {/* Encabezado Ejecutivo + Selector de Carrera */}
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
            Resumen ejecutivo institucional
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            Indicadores agregados y anónimos del campus TESH. Sin acceso a expedientes ni datos
            individuales.
          </p>
        </div>

        <div className="w-full sm:w-72">
          <Select
            value={selectedCareer}
            onValueChange={(value) => setSelectedCareer(value as TeshCareer | "all")}
          >
            <SelectTrigger
              aria-label="Filtrar resumen ejecutivo por carrera"
              className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
            >
              <SelectValue placeholder="Todas las carreras" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
              <SelectItem value="all" className="text-xs font-semibold">
                Todas las carreras (Campus TESH)
              </SelectItem>
              {TESH_CAREERS.map((career) => (
                <SelectItem key={career} value={career} className="text-xs">
                  {career}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* GRID DE 4 KPIs EN CARDS (Mismas reglas clínicas sobrias que /psicologo) */}
      <section
        aria-label="Indicadores ejecutivos principales"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* KPI 1: Total de estudiantes tamizados */}
        <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Total de estudiantes tamizados
            </span>
            <Users className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          </div>

          <div className="my-4">
            <p className="text-4xl font-bold tracking-tight text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
              {totalTamizadosDisplay}
            </p>
          </div>

          <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            {selectedCareer === "all"
              ? "Registros anónimos acumulados en campus"
              : `Cohorte anónima · ${selectedCareer}`}
          </p>
        </article>

        {/* KPI 2: % distribución del semáforo (Donut chart Recharts 3 segmentos) */}
        <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Distribución del semáforo
            </span>
            <span className="text-[11px] font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
              100% anónimo
            </span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="h-28 w-28 shrink-0">
              {isMounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={semaforoDonutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={32}
                      outerRadius={48}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {semaforoDonutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number, name: string) => [`${val}%`, name]}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        borderColor: "#E5DFD3",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-full border border-[#E5DFD3]" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                  <span className="size-2.5 rounded-full bg-[#C8102E]" />
                  Rojo
                </span>
                <span className="font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                  {kpis.pctRojo}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                  <span className="size-2.5 rounded-full bg-[#B8860B]" />
                  Amarillo
                </span>
                <span className="font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                  {kpis.pctAmarillo}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                  <span className="size-2.5 rounded-full bg-[#1F4D2C]" />
                  Verde
                </span>
                <span className="font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                  {kpis.pctVerde}%
                </span>
              </div>
            </div>
          </div>
        </article>

        {/* KPI 3: Tasa de citas completadas vs no_asistio (Bar chart horizontal Recharts) */}
        <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Citas completadas vs no asistió
            </span>
            <span className="text-xs font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
              {citasMetrics.tasaCompletadas}%
            </span>
          </div>

          <div className="mt-3 h-28 w-full">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={citasBarData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 6, bottom: 4 }}
                >
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis
                    type="category"
                    dataKey="estado"
                    width={78}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#6B6B6B", fontWeight: 500 }}
                  />
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, "Tasa"]}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E5DFD3",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="porcentaje" radius={[0, 4, 4, 0]} barSize={16}>
                    {citasBarData.map((entry) => (
                      <Cell key={entry.estado} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-lg border border-[#E5DFD3]" />
            )}
          </div>

          <p className="text-xs font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
            Completadas {citasMetrics.tasaCompletadas}% · No asistió {citasMetrics.tasaNoAsistio}%
          </p>
        </article>

        {/* KPI 4: Promedio de satisfacción de encuestas PB-021 */}
        <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Satisfacción encuestas PB-021
            </span>
            <Star className="size-4 shrink-0 fill-[#B8860B] text-[#B8860B]" />
          </div>

          <div className="my-4 flex items-baseline gap-2">
            <p className="text-4xl font-bold tracking-tight text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
              {pb021Metrics.promedio.toFixed(1)}
            </p>
            <span className="text-sm font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
              / 5.0
            </span>
            <Star className="ml-1 size-5 fill-[#B8860B] text-[#B8860B]" aria-hidden="true" />
          </div>

          <p className="text-xs font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
            {pb021Metrics.totalRespondidas} encuestas respondidas ({pb021Metrics.tasaRespuesta}%)
          </p>
        </article>
      </section>

      {/* BLOQUE INFERIOR: Gráfica por Semestre (paleta institucional) + Matriz Agregada por Carrera */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="semestre-chart-heading"
          className="rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
        >
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
            <div>
              <h3
                id="semestre-chart-heading"
                className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Índice de bienestar por semestre (1º a 9º)
              </h3>
              <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                Promedio agregado de cohorte en escala institucional 1 a 5.
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={semesterData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                  <XAxis
                    dataKey="semesterLabel"
                    tickLine={false}
                    axisLine={{ stroke: "#E5DFD3" }}
                    tick={{ fontSize: 11, fill: "#6B6B6B" }}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tickLine={false}
                    axisLine={{ stroke: "#E5DFD3" }}
                    tick={{ fontSize: 11, fill: "#6B6B6B" }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)} / 5.0`, "Bienestar"]}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#E5DFD3",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="bienestarScore" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {semesterData.map((entry) => {
                      const fill =
                        entry.bienestarScore === 0
                          ? "#E5DFD3"
                          : entry.bienestarScore >= 3.8
                            ? "#1F4D2C"
                            : entry.bienestarScore >= 3.2
                              ? "#4A7C59"
                              : "#B8860B";
                      return <Cell key={entry.semesterLabel} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-lg border border-[#E5DFD3]" />
            )}
          </div>
        </section>

        {/* Tabla densa agregada por carrera */}
        <section
          aria-labelledby="career-summary-heading"
          className="rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
        >
          <div className="mb-4 border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
            <h3
              id="career-summary-heading"
              className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]"
            >
              Distribución agregada por carrera (7 programas TESH)
            </h3>
            <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Métricas anónimas por programa académico sin datos personales.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Carrera
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Tamizados
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Verde
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold text-[#B8860B]">Amarillo</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-[#C8102E]">Rojo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                {careerBreakdown.map((row) => (
                  <tr key={row.career} className="hover:bg-[#F5F1E8]/60 dark:hover:bg-[#0F1A12]/40">
                    <td className="px-3 py-2.5 font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {row.career}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                      {row.total}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                      {row.pctVerde}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#B8860B] tabular-nums">
                      {row.pctAmarillo}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#C8102E] tabular-nums">
                      {row.pctRojo}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Nota institucional LFPDPPP */}
      <footer className="flex items-start gap-3 rounded-lg border border-[#E5DFD3] bg-white p-4 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
            Confidencialidad y privacidad ejecutiva TESH (LFPDPPP)
          </p>
          <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            Esta vista muestra exclusivamente métricas estadísticas agregadas y anónimas. No incluye
            nombres individuales con resultados clínicos ni acceso a expedientes.
          </p>
        </div>
      </footer>
    </div>
  );
}
