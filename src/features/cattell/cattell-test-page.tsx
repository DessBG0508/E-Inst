import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { StudentTopBar } from "@/components/layout/student-top-bar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { CATTELL_ITEMS, scoreCattellItem } from "./cattell-16pf-data";
import {
  enviarEvaluacionCattell,
  fetchMiEvaluacionCattell,
  fetchMisRespuestasCattell,
  guardarProgresoCattell,
} from "./cattell-service";
import type {
  CattellOption,
  EvaluacionCattellRecord,
  RespuestaCattellInput,
} from "./cattell-types";

const ITEMS_PER_PAGE = 8;
const TOTAL_PAGES = Math.ceil(CATTELL_ITEMS.length / ITEMS_PER_PAGE);

interface CattellTestPageProps {
  token?: string;
}

export function CattellTestPage({ token }: CattellTestPageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [evaluacion, setEvaluacion] = useState<EvaluacionCattellRecord | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, CattellOption>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetchMiEvaluacionCattell(user.id, token || null);
      if (!active) return;

      if (res.error) {
        setErrorMsg(res.error);
        setIsLoading(false);
        return;
      }

      if (!res.data) {
        setEvaluacion(null);
        setIsLoading(false);
        return;
      }

      setEvaluacion(res.data);

      if (res.data.estado !== "completado") {
        const respRes = await fetchMisRespuestasCattell(res.data.id);
        if (!active) return;
        if (!respRes.error) {
          setRespuestas(respRes.respuestas);
          // Posicionar en la primera página con preguntas pendientes
          const firstUnansweredIdx = CATTELL_ITEMS.findIndex(
            (item) => !respRes.respuestas[item.numero],
          );
          if (firstUnansweredIdx >= 0) {
            setCurrentPage(Math.floor(firstUnansweredIdx / ITEMS_PER_PAGE));
          }
        }
      }

      setIsLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [user?.id, token]);

  const pageItems = useMemo(() => {
    const start = currentPage * ITEMS_PER_PAGE;
    return CATTELL_ITEMS.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage]);

  const answeredCount = useMemo(() => Object.keys(respuestas).length, [respuestas]);
  const progressPercent = Math.round((answeredCount / CATTELL_ITEMS.length) * 100);

  const pageComplete = useMemo(
    () => pageItems.every((item) => Boolean(respuestas[item.numero])),
    [pageItems, respuestas],
  );

  const handleSelectOption = (numero: number, option: CattellOption) => {
    setRespuestas((prev) => ({ ...prev, [numero]: option }));
  };

  const buildBatchForItems = (items: typeof CATTELL_ITEMS): RespuestaCattellInput[] => {
    const batch: RespuestaCattellInput[] = [];
    for (const item of items) {
      const op = respuestas[item.numero];
      if (op) {
        batch.push({
          numero_pregunta: item.numero,
          factor_codigo: item.factor,
          opcion: op,
          puntos: scoreCattellItem(item, op),
        });
      }
    }
    return batch;
  };

  const handleNextPage = async () => {
    if (!evaluacion) return;
    if (!pageComplete) {
      toast.error("Responde todos los reactivos de esta sección antes de continuar.");
      return;
    }

    setIsSaving(true);
    const batch = buildBatchForItems(pageItems);
    const res = await guardarProgresoCattell(
      evaluacion.id,
      batch,
      answeredCount,
      evaluacion.estado === "pendiente",
    );
    setIsSaving(false);

    if (!res.ok) {
      toast.error(res.error || "No se pudo guardar tu avance.");
      return;
    }

    if (evaluacion.estado === "pendiente") {
      setEvaluacion({ ...evaluacion, estado: "en_progreso" });
    }

    setCurrentPage((p) => Math.min(TOTAL_PAGES - 1, p + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmitFinal = async () => {
    if (!evaluacion) return;
    const missing = CATTELL_ITEMS.filter((item) => !respuestas[item.numero]);
    if (missing.length > 0) {
      toast.error(
        `Faltan ${missing.length} reactivos por responder (iniciando en la pregunta ${missing[0].numero}).`,
      );
      setCurrentPage(Math.floor((missing[0].numero - 1) / ITEMS_PER_PAGE));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setIsSaving(true);
    const fullBatch = buildBatchForItems(CATTELL_ITEMS);
    const res = await enviarEvaluacionCattell(evaluacion.id, fullBatch, respuestas);
    setIsSaving(false);

    if (!res.ok) {
      toast.error(res.error || "No se pudo finalizar la evaluación.");
      return;
    }

    toast.success("Evaluación Cattell (16PF) enviada correctamente.");
    setEvaluacion({
      ...evaluacion,
      estado: "completado",
      reactivos_respondidos: CATTELL_ITEMS.length,
      fecha_completado: new Date().toISOString(),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] dark:bg-[#0F1A12]">
      <StudentTopBar title="Evaluación Educación Dual (16PF)" backTo="/" />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {isLoading ? (
          <div className="rounded-lg border border-[#E5DFD3] bg-white p-10 text-center text-sm text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A6B5A3]">
            Verificando asignación al Programa Dual...
          </div>
        ) : errorMsg ? (
          <div className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-8 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <p className="text-sm font-medium text-[#DC2626] dark:text-[#FCA5A5]">{errorMsg}</p>
            <Button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="h-10 bg-[#1F4D2C] px-5 text-xs font-semibold text-white hover:bg-[#4A7C59]"
            >
              Volver al inicio
            </Button>
          </div>
        ) : !evaluacion ? (
          <div className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-8 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <div className="mx-auto grid size-12 place-items-center rounded-lg bg-[#F5F1E8] text-[#1F4D2C] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
              <Lock className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                Evaluación disponible únicamente para aspirantes seleccionados
              </h2>
              <p className="mx-auto max-w-md text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                Tu cuenta no tiene una prueba Cattell (16PF) asignada actualmente. Si fuiste
                seleccionado para el Programa de Educación Dual, solicita al área de Psicología que
                habilite tu matrícula o verifica el enlace recibido.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="h-10 bg-[#1F4D2C] px-5 text-xs font-semibold text-white hover:bg-[#4A7C59]"
            >
              Regresar a mi inicio
            </Button>
          </div>
        ) : evaluacion.estado === "completado" ? (
          <div className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#E0F0E8] text-[#1F4D2C] dark:bg-[#173620] dark:text-[#8FC9B5]">
                <CheckCircle2 className="size-6" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  {evaluacion.convocatoria_nombre || "Programa Educación Dual"}
                  {evaluacion.convocatoria_periodo ? ` · ${evaluacion.convocatoria_periodo}` : ""}
                </p>
                <h2 className="text-xl font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Evaluación Cattell (16PF) completada
                </h2>
                <p className="text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Tus 64 respuestas quedaron registradas de forma confidencial. El área de
                  Psicología del TESH revisará tu perfil psicométrico y emitirá el dictamen para tu
                  proceso de Educación Dual.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DFD3] pt-4 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                <span>Protegido bajo confidencialidad clínica LFPDPPP</span>
              </span>
              <Button
                type="button"
                onClick={() => navigate({ to: "/" })}
                className="h-9 bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
              >
                Volver al inicio
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Encabezado de instrucciones y barra de progreso */}
            <section className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    <Award className="size-4 shrink-0" />
                    <span>
                      {evaluacion.convocatoria_nombre || "Programa Educación Dual"}
                      {evaluacion.convocatoria_periodo
                        ? ` · ${evaluacion.convocatoria_periodo}`
                        : ""}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Cuestionario de Personalidad Cattell (16PF)
                  </h2>
                </div>
                <div className="text-left sm:text-right">
                  <span className="block font-mono text-sm font-bold tabular-nums text-[#1F4D2C] dark:text-[#8FC9B5]">
                    {answeredCount} / {CATTELL_ITEMS.length}
                  </span>
                  <span className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Sección {currentPage + 1} de {TOTAL_PAGES}
                  </span>
                </div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
                <div
                  className="h-full bg-[#1F4D2C] transition-all duration-200 dark:bg-[#8FC9B5]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                Responde con sinceridad según tu forma habitual de actuar. No hay respuestas buenas
                o malas (salvo los ejercicios de lógica). Evita abusar de la opción intermedia «B»
                salvo cuando ninguna de las dos posturas describa tu conducta.
              </p>
            </section>

            {/* Reactivos de la sección actual */}
            <section className="space-y-4">
              {pageItems.map((item) => {
                const selected = respuestas[item.numero];
                const options: { key: CattellOption; text: string }[] = [
                  { key: "A", text: item.opcionA },
                  { key: "B", text: item.opcionB },
                  { key: "C", text: item.opcionC },
                ];

                return (
                  <fieldset
                    key={item.numero}
                    className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                  >
                    <legend className="sr-only">Pregunta {item.numero}</legend>
                    <div className="mb-3 flex items-baseline gap-2.5">
                      <span className="font-mono text-xs font-bold tabular-nums text-[#1F4D2C] dark:text-[#8FC9B5]">
                        {String(item.numero).padStart(2, "0")}.
                      </span>
                      <p className="text-sm font-semibold leading-snug text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {item.enunciado}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {options.map((opt) => {
                        const isSelected = selected === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleSelectOption(item.numero, opt.key)}
                            aria-pressed={isSelected}
                            className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors sm:text-sm ${
                              isSelected
                                ? "border-[#1F4D2C] bg-[#1F4D2C]/8 font-semibold text-[#1F4D2C] dark:border-[#8FC9B5] dark:bg-[#173620] dark:text-[#F5F1E8]"
                                : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8]/70 dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#1A2618]"
                            }`}
                          >
                            <span
                              className={`grid size-6 shrink-0 place-items-center rounded-md border font-mono text-xs font-bold ${
                                isSelected
                                  ? "border-[#1F4D2C] bg-[#1F4D2C] text-white dark:border-[#8FC9B5] dark:bg-[#8FC9B5] dark:text-[#0F1A12]"
                                  : "border-[#E5DFD3] text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]"
                              }`}
                            >
                              {opt.key}
                            </span>
                            <span className="leading-snug">{opt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </section>

            {/* Navegación entre páginas */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentPage === 0 || isSaving}
                onClick={() => {
                  setCurrentPage((p) => Math.max(0, p - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="h-10 gap-1.5 rounded-lg border-[#E5DFD3] bg-white px-4 text-xs font-semibold dark:border-[#2D3F2A] dark:bg-[#1A2618]"
              >
                <ArrowLeft className="size-4" />
                <span>Anterior</span>
              </Button>

              {currentPage < TOTAL_PAGES - 1 ? (
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={handleNextPage}
                  className="h-10 gap-1.5 rounded-lg bg-[#1F4D2C] px-5 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                >
                  <span>{isSaving ? "Guardando avance..." : "Guardar y continuar"}</span>
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSubmitFinal}
                  className="h-10 gap-1.5 rounded-lg bg-[#1F4D2C] px-5 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                >
                  <ClipboardCheck className="size-4" />
                  <span>{isSaving ? "Enviando evaluación..." : "Finalizar y enviar"}</span>
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
