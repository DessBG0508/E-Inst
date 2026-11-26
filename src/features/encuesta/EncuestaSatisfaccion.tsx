import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Home,
  Loader2,
  Lock,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
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
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { StudentTopBar } from "@/components/layout/student-top-bar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { brandConfig } from "@/config/brand-config";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/lib/types";
import {
  calcularMetricasEncuesta,
  getRespuestasEncuesta,
  guardarRespuestaEncuesta,
  validarFolioUsuario,
} from "./encuesta-service";
import {
  PREGUNTAS_ENCUESTA,
  type MetricasEncuesta,
  type RespuestaEncuesta,
  type TriggerEncuestaTipo,
} from "./types";

interface EncuestaSatisfaccionProps {
  folio?: string;
  triggerTipo?: TriggerEncuestaTipo;
  userId?: string;
  user?: User | null;
  onCompletada?: (hash: string) => void;
}

type RecomendacionEli = "si" | "tal_vez" | "no";

const TOTAL_PASOS = 10;

const OPCIONES_RECOMENDACION_ELI: {
  id: RecomendacionEli;
  label: string;
  valorNumerico: number;
}[] = [
  { id: "si", label: "Sí", valorNumerico: 5 },
  { id: "tal_vez", label: "Tal vez", valorNumerico: 3 },
  { id: "no", label: "No", valorNumerico: 1 },
];

const ETIQUETAS_ESTRELLAS_ELI: Record<number, string> = {
  1: "Muy deficiente",
  2: "Regular",
  3: "Aceptable",
  4: "Buena",
  5: "Excelente",
};

export const EncuestaSatisfaccion: React.FC<EncuestaSatisfaccionProps> = ({
  folio = "",
  triggerTipo = "alta",
  userId,
  user: userProp,
  onCompletada,
}) => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const activeUser = userProp !== undefined ? userProp : authUser;

  const esPersonalAutorizado =
    activeUser?.role === "psicologo" ||
    activeUser?.role === "directivo" ||
    activeUser?.role === "jefatura" ||
    activeUser?.role === "coordinador";

  // Vista activa (solo psicólogo/directivo pueden alternar a analítica)
  const [vistaActiva, setVistaActiva] = useState<"encuesta" | "analitica">("encuesta");

  // Paso 0 = Validación de folio; Pasos 1..10 = Preguntas; completada = pantalla gracias
  const [pasoActual, setPasoActual] = useState<number>(0);
  const [folioInput, setFolioInput] = useState<string>(folio ? folio.toUpperCase() : "");
  const [folioConfirmado, setFolioConfirmado] = useState<string>("");
  const [validandoFolio, setValidandoFolio] = useState<boolean>(false);
  const [errorFolio, setErrorFolio] = useState<string | null>(null);

  // Sincronizar folio inicial si llega por URL/sesión
  useEffect(() => {
    if (folio && !folioInput && pasoActual === 0) {
      setFolioInput(folio.toUpperCase());
    }
  }, [folio, folioInput, pasoActual]);

  // Estado de respuestas del cuestionario
  const [respuestas, setRespuestas] = useState<Record<string, number>>({
    q1_satisfaccion: 0,
    q2_escuchado: 0,
    q3_claridad: 0,
    q4_respeto: 0,
    q5_tiempo_espera: 0,
    q6_utilidad: 0,
    q7_mejoria: 0,
    q8_recomendar: 0,
    q10a_facilidad_eli: 0,
  });
  const [q9Comentarios, setQ9Comentarios] = useState<string>("");
  const [q10bRecomendacion, setQ10bRecomendacion] = useState<RecomendacionEli | null>(null);

  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [completada, setCompletada] = useState<boolean>(false);
  const [hashGenerado, setHashGenerado] = useState<string | null>(null);
  const [eliImgError, setEliImgError] = useState<boolean>(false);

  // Estado de analítica y exportación (solo psicólogo/directivo)
  const [respuestasAdmin, setRespuestasAdmin] = useState<RespuestaEncuesta[]>([]);
  const [metricasAdmin, setMetricasAdmin] = useState<MetricasEncuesta | null>(null);
  const [cargandoAnalitica, setCargandoAnalitica] = useState<boolean>(false);
  const [exportandoExcel, setExportandoExcel] = useState<boolean>(false);

  const cargarAnalitica = useCallback(async () => {
    if (!esPersonalAutorizado) return;
    setCargandoAnalitica(true);
    try {
      const lista = await getRespuestasEncuesta();
      setRespuestasAdmin(lista);
      setMetricasAdmin(calcularMetricasEncuesta(lista));
    } finally {
      setCargandoAnalitica(false);
    }
  }, [esPersonalAutorizado]);

  useEffect(() => {
    if (esPersonalAutorizado && vistaActiva === "analitica") {
      cargarAnalitica();
    }
  }, [esPersonalAutorizado, vistaActiva, cargarAnalitica]);

  // Validar folio (P0 #9) con Edge Function 'enviar-encuesta' + JWT
  const handleValidarFolio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFolio(null);

    const limpio = folioInput.trim().toUpperCase();
    if (!limpio) {
      setErrorFolio("Ingresa tu folio institucional (por ejemplo EQ-9374 o TESH-2026-0842).");
      return;
    }

    setValidandoFolio(true);
    try {
      const res = await validarFolioUsuario(limpio, activeUser);
      if (!res.valido) {
        setErrorFolio(
          res.motivo ||
            "El folio proporcionado no pertenece a tu cuenta institucional o no es válido.",
        );
        return;
      }
      setFolioConfirmado(limpio);
      setPasoActual(1);
    } catch (err) {
      setErrorFolio(
        err instanceof Error ? err.message : "No fue posible validar el folio en este momento.",
      );
    } finally {
      setValidandoFolio(false);
    }
  };

  const handleSelectValor = (preguntaId: string, valor: number) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: valor }));
    if (errorValidacion) setErrorValidacion(null);
  };

  const handleAnterior = () => {
    setErrorValidacion(null);
    if (pasoActual > 1) {
      setPasoActual((prev) => prev - 1);
    } else {
      setPasoActual(0);
    }
  };

  const handleSiguiente = () => {
    setErrorValidacion(null);

    if (pasoActual >= 1 && pasoActual <= 8) {
      const pregunta = PREGUNTAS_ENCUESTA[pasoActual - 1];
      if (!respuestas[pregunta.id] || respuestas[pregunta.id] === 0) {
        setErrorValidacion("Selecciona una calificación del 1 al 5 para continuar.");
        return;
      }
      setPasoActual((prev) => prev + 1);
      return;
    }

    // Pregunta 9 (Comentarios adicionales) es opcional
    if (pasoActual === 9) {
      setPasoActual(10);
    }
  };

  const handleEnviarEncuesta = async () => {
    setErrorValidacion(null);

    if (!respuestas.q10a_facilidad_eli || respuestas.q10a_facilidad_eli === 0) {
      setErrorValidacion("Selecciona una valoración de 1 a 5 estrellas para Eli.");
      return;
    }
    if (!q10bRecomendacion) {
      setErrorValidacion("Indica si recomendarías a Eli a otros estudiantes.");
      return;
    }

    const valorRecomendacion =
      OPCIONES_RECOMENDACION_ELI.find((o) => o.id === q10bRecomendacion)?.valorNumerico ?? 3;

    setEnviando(true);
    try {
      const res = await guardarRespuestaEncuesta({
        folio: folioConfirmado,
        user_id: userId || activeUser?.id || null,
        trigger_tipo: triggerTipo,
        trigger_fecha: new Date().toISOString(),
        enviada_en: new Date().toISOString(),
        q1_satisfaccion: respuestas.q1_satisfaccion,
        q2_escuchado: respuestas.q2_escuchado,
        q3_claridad: respuestas.q3_claridad,
        q4_respeto: respuestas.q4_respeto,
        q5_tiempo_espera: respuestas.q5_tiempo_espera,
        q6_utilidad: respuestas.q6_utilidad,
        q7_mejoria: respuestas.q7_mejoria,
        q8_recomendar: respuestas.q8_recomendar,
        q9_comentarios: q9Comentarios.trim() || null,
        q10a_facilidad_eli: respuestas.q10a_facilidad_eli,
        q10b_util_eli: valorRecomendacion,
        q10b_recomendacion: q10bRecomendacion,
      });

      if (res.ok && res.hash) {
        setHashGenerado(res.hash);
        setCompletada(true);
        if (onCompletada) onCompletada(res.hash);
      } else {
        setErrorValidacion(res.error || "Ocurrió un error al registrar tu encuesta.");
      }
    } catch (err) {
      setErrorValidacion(
        err instanceof Error ? err.message : "Error inesperado de conexión con el servidor.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleExportarExcel = () => {
    if (!esPersonalAutorizado || respuestasAdmin.length === 0) return;
    setExportandoExcel(true);
    try {
      const filas = respuestasAdmin.map((r) => {
        const promClinico =
          (r.q1_satisfaccion +
            r.q2_escuchado +
            r.q3_claridad +
            r.q4_respeto +
            r.q5_tiempo_espera +
            r.q6_utilidad +
            r.q7_mejoria +
            r.q8_recomendar) /
          8;

        const textoRecomienda =
          r.q10b_recomendacion === "si"
            ? "Sí"
            : r.q10b_recomendacion === "tal_vez"
              ? "Tal vez"
              : r.q10b_recomendacion === "no"
                ? "No"
                : r.q10b_util_eli >= 4
                  ? "Sí"
                  : r.q10b_util_eli === 3
                    ? "Tal vez"
                    : "No";

        return {
          "Folio (MIN-008)": r.folio,
          "Fecha Respondida": r.respondida_en
            ? new Date(r.respondida_en).toLocaleString("es-MX", {
                timeZone: "America/Mexico_City",
              })
            : "Pendiente",
          Disparador:
            r.trigger_tipo === "alta" ? "Alta de Proceso (24h)" : "Inasistencias (15 días)",
          "Q1 Satisfacción": r.q1_satisfaccion,
          "Q2 Escucha": r.q2_escuchado,
          "Q3 Claridad": r.q3_claridad,
          "Q4 Respeto/Privacidad": r.q4_respeto,
          "Q5 Puntualidad/Espacio": r.q5_tiempo_espera,
          "Q6 Herramientas": r.q6_utilidad,
          "Q7 Mejoría": r.q7_mejoria,
          "Q8 Recomendar Servicio": r.q8_recomendar,
          "Q9 Comentarios": r.q9_comentarios || "—",
          "Q10A Eli Estrellas (1-5)": r.q10a_facilidad_eli,
          "Q10B Recomienda Eli": textoRecomienda,
          "Promedio Q1-Q8": Number(promClinico.toFixed(2)),
          "Hash Auditoría": r.hash_auditoria,
        };
      });

      const hoja = XLSX.utils.json_to_sheet(filas);
      hoja["!cols"] = [
        { wch: 18 },
        { wch: 22 },
        { wch: 24 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 20 },
        { wch: 15 },
        { wch: 12 },
        { wch: 20 },
        { wch: 42 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 30 },
      ];
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Encuestas PB-021");
      XLSX.writeFile(libro, `Equilibra_TESH_PB021_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExportandoExcel(false);
    }
  };

  const homeDestino =
    activeUser?.role === "psicologo"
      ? "/psicologo"
      : activeUser?.role === "jefatura"
        ? "/jefatura"
        : activeUser?.role === "directivo" || activeUser?.role === "coordinador"
          ? "/directivo"
          : activeUser?.role === "tutor"
            ? "/tutor"
            : "/";

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Inicio",
      onClick: () => navigate({ to: homeDestino }),
    },
    {
      label: "Encuesta de satisfacción",
    },
  ];

  const preguntaLikertActual =
    pasoActual >= 1 && pasoActual <= 8 ? PREGUNTAS_ENCUESTA[pasoActual - 1] : null;
  const progresoPorcentaje = Math.round((pasoActual / TOTAL_PASOS) * 100);

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      {esPersonalAutorizado ? (
        <InstitutionalHeader
          moduleTitle="Encuesta de satisfacción"
          breadcrumbs={breadcrumbs}
          onHomeClick={() => navigate({ to: homeDestino })}
          backFallbackRoute={homeDestino}
          showCrisisButton={false}
          actions={
            <>
              <AjustesModal
                rol={activeUser?.role || "estudiante"}
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
      ) : (
        <StudentTopBar
          title="Encuesta de satisfacción"
          backTo={homeDestino}
          rightActions={
            <AjustesModal
              rol={activeUser?.role || "estudiante"}
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
          }
        />
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Selector de vista exclusivo para psicólogo o directivo */}
        {esPersonalAutorizado && (
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5DFD3] bg-white p-2 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVistaActiva("encuesta")}
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
                  vistaActiva === "encuesta"
                    ? "bg-[#1F4D2C] text-white"
                    : "text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12]"
                }`}
              >
                <ClipboardCheck className="size-4" />
                <span>Instrumento PB-021</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaActiva("analitica")}
                className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
                  vistaActiva === "analitica"
                    ? "bg-[#1F4D2C] text-white"
                    : "text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12]"
                }`}
              >
                <BarChart3 className="size-4" />
                <span>Analítica y exportación</span>
              </button>
            </div>
            <span className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
              Vista clínica / directiva
            </span>
          </div>
        )}

        {/* PANEL DE ANALÍTICA Y EXPORTACIÓN (SOLO PSICÓLOGO / DIRECTIVO) */}
        {esPersonalAutorizado && vistaActiva === "analitica" ? (
          <section aria-label="Analítica y exportación PB-021" className="space-y-6">
            <div className="flex flex-col justify-between gap-4 rounded-lg border border-[#E5DFD3] bg-white p-6 sm:flex-row sm:items-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Instrumento PB-021 · Acuerdo MIN-008
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Resultados y distribución de satisfacción
                </h2>
                <p className="mt-0.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Registros identificados por folio institucional para evaluación continua del
                  servicio psicológico.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleExportarExcel}
                disabled={exportandoExcel || cargandoAnalitica || respuestasAdmin.length === 0}
                className="h-10 shrink-0 cursor-pointer gap-2 rounded-lg bg-[#1F4D2C] px-4 text-sm font-semibold text-white hover:bg-[#4A7C59] disabled:opacity-50"
              >
                {exportandoExcel ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                <span>Exportar a Excel</span>
              </Button>
            </div>

            {cargandoAnalitica ? (
              <div className="rounded-lg border border-[#E5DFD3] bg-white p-12 text-center text-sm text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A6B5A3]">
                Cargando métricas de satisfacción PB-021...
              </div>
            ) : metricasAdmin ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Encuestas respondidas
                    </p>
                    <p className="mt-2 text-3xl font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      {metricasAdmin.totalRespondidas}
                    </p>
                    <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Tasa de respuesta: {metricasAdmin.tasaRespuesta}%
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Satisfacción general (Q1–Q8)
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        {metricasAdmin.promedioGeneral.toFixed(2)}
                      </span>
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        / 5.00
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      NPS Q8:{" "}
                      {metricasAdmin.npsScore > 0
                        ? `+${metricasAdmin.npsScore}`
                        : metricasAdmin.npsScore}{" "}
                      pts
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Valoración de Eli (Q10A–Q10B)
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        {metricasAdmin.promedioEli.toFixed(2)}
                      </span>
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        / 5.00
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Alta: {metricasAdmin.totalAltas} · Abandono: {metricasAdmin.totalAbandonos}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* GRÁFICA DONUT: DISTRIBUCIÓN Q1–Q8 */}
                  <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div>
                      <h3 className="text-sm font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Distribución de respuestas Q1–Q8
                      </h3>
                      <p className="mt-0.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Frecuencia acumulada por nivel de escala Likert (1 a 5).
                      </p>
                    </div>

                    <div className="my-4 h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metricasAdmin.distribucionSatisfaccion}
                            dataKey="cantidad"
                            nameKey="nombre"
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={82}
                            paddingAngle={2}
                          >
                            {metricasAdmin.distribucionSatisfaccion.map((entry, idx) => (
                              <Cell key={`donut-${idx}`} fill={entry.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#FFFFFF",
                              borderRadius: "8px",
                              border: "1px solid #E5DFD3",
                              fontSize: "12px",
                              color: "#1A1A1A",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-[#E5DFD3] pt-3 text-xs dark:border-[#2D3F2A]">
                      {metricasAdmin.distribucionSatisfaccion.map((item) => (
                        <div key={item.nombre} className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {item.nombre}:
                          </span>
                          <strong className="text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {item.cantidad}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* GRÁFICA BARRAS: SATISFACCIÓN GENERAL POR REACTIVO */}
                  <div className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 lg:col-span-7 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div>
                      <h3 className="text-sm font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Satisfacción general por reactivo
                      </h3>
                      <p className="mt-0.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Calificación promedio institucional en escala de 1 a 5.
                      </p>
                    </div>

                    <div className="my-4 h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={metricasAdmin.promediosPorReactivo}
                          margin={{ top: 10, right: 12, left: -20, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD3" vertical={false} />
                          <XAxis
                            dataKey="clave"
                            tick={{ fontSize: 11, fontWeight: 600, fill: "#1F4D2C" }}
                          />
                          <YAxis
                            domain={[0, 5]}
                            ticks={[1, 2, 3, 4, 5]}
                            tick={{ fontSize: 11, fill: "#6B6B6B" }}
                          />
                          <Tooltip
                            formatter={(val: number) => [`${val.toFixed(2)} / 5.0`, "Promedio"]}
                            labelFormatter={(label) => {
                              const found = metricasAdmin.promediosPorReactivo.find(
                                (p) => p.clave === label,
                              );
                              return found ? `${found.clave}: ${found.label}` : String(label);
                            }}
                            contentStyle={{
                              backgroundColor: "#FFFFFF",
                              borderRadius: "8px",
                              border: "1px solid #E5DFD3",
                              fontSize: "12px",
                              color: "#1A1A1A",
                            }}
                          />
                          <Bar
                            dataKey="promedio"
                            fill="#1F4D2C"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={34}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#E5DFD3] pt-3 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                      <span>Instrumento PB-021 · Paleta institucional TESH</span>
                      <span>{respuestasAdmin.length} registros totales</span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        ) : (
          /* CARD CENTRAL DE LA ENCUESTA PB-021 */
          <section className="mx-auto w-full max-w-2xl">
            {completada ? (
              /* PANTALLA DE AGRADECIMIENTO */
              <div className="space-y-6 rounded-lg border border-[#E5DFD3] bg-white p-8 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                <div className="mx-auto flex size-24 items-center justify-center overflow-hidden rounded-full border border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  {!eliImgError && brandConfig.eliAvatarUrl ? (
                    <img
                      src={brandConfig.eliAvatarUrl}
                      alt="Mascota institucional Eli"
                      className="size-20 object-contain"
                      onError={() => setEliImgError(true)}
                    />
                  ) : (
                    <Bot className="size-10 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-[#1F4D2C]/25 bg-[#F5F1E8] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#1F4D2C] dark:border-[#8FC9B5]/30 dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    <CheckCircle2 className="size-3.5" />
                    <span>Encuesta PB-021 registrada</span>
                  </div>
                  <h2 className="text-2xl font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Gracias por tu retroalimentación
                  </h2>
                  <p className="mx-auto max-w-md text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Tus respuestas quedaron vinculadas al folio institucional{" "}
                    <strong className="font-mono text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {folioConfirmado}
                    </strong>{" "}
                    (acuerdo MIN-008) para fortalecer el servicio de apoyo psicológico del TESH.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 text-left dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                    <span className="flex items-center gap-1.5 text-[#1F4D2C] dark:text-[#8FC9B5]">
                      <ShieldCheck className="size-4" />
                      Constancia criptográfica SHA-256
                    </span>
                    <span className="font-mono text-[11px]">MIN-008</span>
                  </div>
                  <p className="break-all rounded-md border border-[#E5DFD3] bg-white p-2.5 font-mono text-[11px] text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
                    {hashGenerado || "—"}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                  <Link
                    to={homeDestino}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1F4D2C] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#4A7C59] sm:w-auto"
                  >
                    <Home className="size-4" />
                    <span>Volver al inicio</span>
                  </Link>
                  <Link
                    to="/citas"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#E5DFD3] bg-white px-5 text-sm font-semibold text-[#1A1A1A] transition-colors hover:bg-[#F5F1E8] sm:w-auto dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                  >
                    <Calendar className="size-4" />
                    <span>Ver mis citas</span>
                  </Link>
                </div>
              </div>
            ) : pasoActual === 0 ? (
              /* PANTALLA INICIAL: VALIDACIÓN DE FOLIO (P0 #9) */
              <div className="space-y-6 rounded-lg border border-[#E5DFD3] bg-white p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                <div className="space-y-2 border-b border-[#E5DFD3] pb-5 dark:border-[#2D3F2A]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1F4D2C]/25 bg-[#F5F1E8] px-2.5 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#8FC9B5]/30 dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                      <Lock className="size-3.5" />
                      PB-021 · Identificada por folio (MIN-008)
                    </span>
                    <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      10 reactivos clínicos
                    </span>
                  </div>
                  <h1 className="pt-1 text-2xl font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Encuesta de satisfacción
                  </h1>
                  <p className="text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Este instrumento evalúa la calidad de la atención psicológica recibida en el
                    TESH. Por acuerdo institucional (MIN-008), no es anónimo y requiere validar que
                    el folio pertenezca a tu cuenta.
                  </p>
                </div>

                {!activeUser && (
                  <div className="flex items-start gap-3 rounded-lg border border-[#C8102E] bg-[#FEE2E2] p-4 text-sm text-[#C8102E]">
                    <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                    <div className="space-y-2">
                      <p className="font-semibold">Sesión institucional requerida</p>
                      <p className="text-xs">
                        Inicia sesión con tu cuenta institucional del TESH para verificar la
                        titularidad de tu folio.
                      </p>
                      <Link
                        to="/login"
                        className="inline-flex h-9 items-center rounded-md bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#9B0C24]"
                      >
                        Ir a iniciar sesión
                      </Link>
                    </div>
                  </div>
                )}

                <form onSubmit={handleValidarFolio} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="folio-pb021"
                      className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                    >
                      Folio institucional (EQ-XXXX)
                    </Label>
                    <Input
                      id="folio-pb021"
                      type="text"
                      value={folioInput}
                      onChange={(e) => {
                        setFolioInput(e.target.value.toUpperCase());
                        if (errorFolio) setErrorFolio(null);
                      }}
                      placeholder="Ej. EQ-9374 o TESH-2026-0842"
                      autoComplete="off"
                      disabled={validandoFolio}
                      className="h-11 rounded-lg border-[#E5DFD3] bg-white font-mono text-sm uppercase text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                    />
                    <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Ingresa el folio asignado en tu tamizaje con Eli o en tu comprobante de cita.
                    </p>
                  </div>

                  {errorFolio && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-lg border border-[#C8102E] bg-[#FEE2E2] p-3.5 text-xs font-semibold text-[#C8102E]"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{errorFolio}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={validandoFolio || !activeUser}
                    className="h-11 w-full cursor-pointer gap-2 rounded-lg bg-[#1F4D2C] text-sm font-semibold text-white hover:bg-[#4A7C59] disabled:opacity-50"
                  >
                    {validandoFolio ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Validando titularidad del folio...</span>
                      </>
                    ) : (
                      <>
                        <span>Validar folio y comenzar</span>
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              /* CUESTIONARIO PASO A PASO (1 DE 10 ... 10 DE 10) */
              <div className="space-y-6 rounded-lg border border-[#E5DFD3] bg-white p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                {/* Barra de progreso arriba */}
                <div className="space-y-2.5 border-b border-[#E5DFD3] pb-5 dark:border-[#2D3F2A]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Pregunta {pasoActual} de {TOTAL_PASOS}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Folio: {folioConfirmado}
                      </span>
                      <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {progresoPorcentaje}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
                    <div
                      className="h-full rounded-full bg-[#1F4D2C] transition-all duration-300 dark:bg-[#4A7C59]"
                      style={{ width: `${progresoPorcentaje}%` }}
                    />
                  </div>
                </div>

                {/* PREGUNTAS Q1–Q8 (ESCALA LIKERT 1–5 CON BOTONES CIRCULARES NUMERADOS) */}
                {preguntaLikertActual && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Módulo I · Atención psicológica ({pasoActual} de 8)
                      </p>
                      <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {preguntaLikertActual.numero}. {preguntaLikertActual.titulo}
                      </h2>
                      <p className="text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                        {preguntaLikertActual.descripcion}
                      </p>
                    </div>

                    <Separator className="bg-[#E5DFD3] dark:bg-[#2D3F2A]" />

                    <div className="space-y-4 py-2">
                      <div className="flex items-center justify-between gap-2 sm:justify-center sm:gap-5">
                        {[1, 2, 3, 4, 5].map((valor) => {
                          const seleccionado = respuestas[preguntaLikertActual.id] === valor;
                          return (
                            <button
                              key={valor}
                              type="button"
                              aria-label={`Calificación ${valor} de 5`}
                              aria-pressed={seleccionado}
                              onClick={() => handleSelectValor(preguntaLikertActual.id, valor)}
                              className={`flex size-12 cursor-pointer items-center justify-center rounded-full border text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] sm:size-14 ${
                                seleccionado
                                  ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
                                  : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:border-[#1F4D2C] hover:text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:border-[#8FC9B5]"
                              }`}
                            >
                              {valor}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        <span>1 = Muy insatisfecho</span>
                        <span>5 = Muy satisfecho</span>
                      </div>

                      {respuestas[preguntaLikertActual.id] > 0 && (
                        <p className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 text-center text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                          Selección actual: {respuestas[preguntaLikertActual.id]} —{" "}
                          {
                            preguntaLikertActual.escala.find(
                              (e) => e.valor === respuestas[preguntaLikertActual.id],
                            )?.etiqueta
                          }
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* PREGUNTA Q9: TEXTO LIBRE (MÁXIMO 500 CARACTERES, OPCIONAL) */}
                {pasoActual === 9 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Módulo I · Retroalimentación abierta
                        </p>
                        <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-2 py-0.5 text-[11px] font-semibold text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
                          Opcional
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        9. Comentarios adicionales
                      </h2>
                      <p className="text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Comparte observaciones sobre la atención recibida, horarios o sugerencias de
                        mejora para el área de psicología.
                      </p>
                    </div>

                    <Separator className="bg-[#E5DFD3] dark:bg-[#2D3F2A]" />

                    <div className="space-y-2">
                      <Label
                        htmlFor="q9-comentarios"
                        className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                      >
                        Comentarios adicionales
                      </Label>
                      <Textarea
                        id="q9-comentarios"
                        rows={5}
                        maxLength={500}
                        value={q9Comentarios}
                        onChange={(e) => setQ9Comentarios(e.target.value)}
                        placeholder="Escribe tus comentarios adicionales (máximo 500 caracteres)..."
                        className="resize-none rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                      />
                      <div className="flex justify-end text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        <span>{q9Comentarios.length} / 500 caracteres</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* PREGUNTA 10: Q10A (ESTRELLAS ELI) + Q10B (RECOMENDACIÓN PILLS) */}
                {pasoActual === 10 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Módulo II · Evaluación de Eli
                      </p>
                      <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        10.A Valoración de Eli en el tamizaje inicial
                      </h2>
                      <p className="text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                        ¿Cómo calificas tu experiencia con Eli al responder tus cuestionarios
                        iniciales?
                      </p>
                    </div>

                    <div className="flex flex-col items-center gap-3 py-1">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {[1, 2, 3, 4, 5].map((estrella) => {
                          const activa = respuestas.q10a_facilidad_eli >= estrella;
                          return (
                            <button
                              key={estrella}
                              type="button"
                              aria-label={`${estrella} de 5 estrellas`}
                              aria-pressed={respuestas.q10a_facilidad_eli === estrella}
                              onClick={() => handleSelectValor("q10a_facilidad_eli", estrella)}
                              className={`flex size-12 cursor-pointer items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] ${
                                activa
                                  ? "border-[#B8860B] bg-[#F5F1E8] dark:border-[#B8860B] dark:bg-[#0F1A12]"
                                  : "border-[#E5DFD3] bg-white hover:border-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                              }`}
                            >
                              <Star
                                className={`size-6 ${
                                  activa
                                    ? "fill-[#B8860B] text-[#B8860B]"
                                    : "text-[#6B6B6B]/40 dark:text-[#A6B5A3]/40"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        {respuestas.q10a_facilidad_eli > 0
                          ? `${respuestas.q10a_facilidad_eli} / 5 — ${
                              ETIQUETAS_ESTRELLAS_ELI[respuestas.q10a_facilidad_eli]
                            }`
                          : "Selecciona de 1 a 5 estrellas"}
                      </p>
                    </div>

                    <Separator className="bg-[#E5DFD3] dark:bg-[#2D3F2A]" />

                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          10.B ¿Recomendarías a Eli a otros estudiantes?
                        </h3>
                        <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Selecciona una opción sobre la utilidad del primer contacto con Eli.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {OPCIONES_RECOMENDACION_ELI.map((opcion) => {
                          const seleccionada = q10bRecomendacion === opcion.id;
                          return (
                            <button
                              key={opcion.id}
                              type="button"
                              aria-pressed={seleccionada}
                              onClick={() => {
                                setQ10bRecomendacion(opcion.id);
                                if (errorValidacion) setErrorValidacion(null);
                              }}
                              className={`cursor-pointer rounded-full border px-6 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] ${
                                seleccionada
                                  ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
                                  : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:border-[#1F4D2C] hover:text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                              }`}
                            >
                              {opcion.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* MENSAJE DE VALIDACIÓN */}
                {errorValidacion && (
                  <div
                    role="alert"
                    className="flex items-center gap-2.5 rounded-lg border border-[#C8102E] bg-[#FEE2E2] p-3.5 text-xs font-semibold text-[#C8102E]"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{errorValidacion}</span>
                  </div>
                )}

                {/* NAVEGACIÓN: ANTERIOR (ghost) + SIGUIENTE / ENVIAR (bg-[#1F4D2C]) */}
                <div className="flex items-center justify-between gap-3 border-t border-[#E5DFD3] pt-6 dark:border-[#2D3F2A]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleAnterior}
                    disabled={enviando}
                    className="h-11 cursor-pointer gap-2 text-sm font-semibold text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12]"
                  >
                    <ArrowLeft className="size-4" />
                    <span>Anterior</span>
                  </Button>

                  {pasoActual < TOTAL_PASOS ? (
                    <Button
                      type="button"
                      onClick={handleSiguiente}
                      className="h-11 cursor-pointer gap-2 rounded-lg bg-[#1F4D2C] px-6 text-sm font-semibold text-white hover:bg-[#4A7C59]"
                    >
                      <span>Siguiente</span>
                      <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleEnviarEncuesta}
                      disabled={enviando}
                      className="h-11 cursor-pointer gap-2 rounded-lg bg-[#1F4D2C] px-6 text-sm font-semibold text-white hover:bg-[#4A7C59] disabled:opacity-50"
                    >
                      {enviando ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          <span>Enviar encuesta</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
