import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileBarChart2,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import {
  CATTELL_FACTORS,
  CATTELL_GLOBAL_META,
  evaluarPreRecomendacionDual,
} from "@/features/cattell/cattell-16pf-data";
import {
  computeCattellStats,
  createConvocatoriaDual,
  fetchConvocatoriasDual,
  fetchEstudiantesParaDual,
  fetchEvaluacionesByConvocatoria,
  guardarDictamenCattell,
  habilitarEstudiantesCattell,
  removerAspirantePendiente,
  toggleConvocatoriaActiva,
} from "@/features/cattell/cattell-service";
import type {
  CattellFactorCode,
  CattellGlobalCode,
  ConvocatoriaDual,
  DictamenCattell,
  EstudianteDualOption,
  EvaluacionCattellRecord,
} from "@/features/cattell/cattell-types";

const TESH_CAREERS = [
  "Ing. Civil",
  "Ing. Industrial",
  "Ing. Mecatrónica",
  "Ing. en Sistemas Computacionales",
  "Lic. en Administración",
  "Lic. en Biología",
  "Lic. en Gastronomía",
] as const;

type QuickStatFilter =
  "todos" | "pendientes" | "completados" | "apto" | "apto_con_observaciones" | "no_apto";

const DICTAMEN_LABELS: Record<DictamenCattell, { label: string; className: string }> = {
  pendiente: {
    label: "Sin dictamen",
    className: "text-[#6B6B6B] dark:text-[#A6B5A3]",
  },
  apto: {
    label: "Apto",
    className: "text-[#16A34A] font-semibold dark:text-[#8FC9B5]",
  },
  apto_con_observaciones: {
    label: "Apto con observaciones",
    className: "text-[#D97706] font-semibold dark:text-[#FCD34D]",
  },
  no_apto: {
    label: "No apto",
    className: "text-[#DC2626] font-semibold dark:text-[#FCA5A5]",
  },
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function GestionCattellDual() {
  const { user } = useAuth();

  const [convocatorias, setConvocatorias] = useState<ConvocatoriaDual[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionCattellRecord[]>([]);
  const [estudiantes, setEstudiantes] = useState<EstudianteDualOption[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEvals, setIsLoadingEvals] = useState(false);

  // Filtros de la tabla principal
  const [statFilter, setStatFilter] = useState<QuickStatFilter>("todos");
  const [careerFilter, setCareerFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal: Nueva Convocatoria
  const [isNewConvOpen, setIsNewConvOpen] = useState(false);
  const [newConvNombre, setNewConvNombre] = useState("Programa Educación Dual 2026-2");
  const [newConvPeriodo, setNewConvPeriodo] = useState("2026-2");
  const [newConvFechaLimite, setNewConvFechaLimite] = useState("");
  const [newConvDesc, setNewConvDesc] = useState("");
  const [isCreatingConv, setIsCreatingConv] = useState(false);

  // Modal: Seleccionar aspirantes (todas las carreras)
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalCareer, setModalCareer] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPasteMatriculas, setShowPasteMatriculas] = useState(false);
  const [matriculasInput, setMatriculasInput] = useState("");
  const [isSavingSelection, setIsSavingSelection] = useState(false);

  // Modal: Perfil 16PF y Dictamen
  const [activeProfile, setActiveProfile] = useState<EvaluacionCattellRecord | null>(null);
  const [dictamenInput, setDictamenInput] = useState<DictamenCattell>("pendiente");
  const [observacionesInput, setObservacionesInput] = useState("");
  const [isSavingDictamen, setIsSavingDictamen] = useState(false);

  const loadBaseData = useCallback(async () => {
    setIsLoading(true);
    setSchemaError(null);
    const [convRes, estRes] = await Promise.all([
      fetchConvocatoriasDual(),
      fetchEstudiantesParaDual(),
    ]);

    if (convRes.error) {
      setSchemaError(convRes.error);
      setIsLoading(false);
      return;
    }

    setConvocatorias(convRes.data);
    if (!estRes.error) {
      setEstudiantes(estRes.data);
    }

    if (convRes.data.length > 0) {
      setSelectedConvId((prev) =>
        prev && convRes.data.some((c) => c.id === prev) ? prev : convRes.data[0].id,
      );
    } else {
      setSelectedConvId("");
      setEvaluaciones([]);
    }
    setIsLoading(false);
  }, []);

  const loadEvaluaciones = useCallback(async (convId: string) => {
    if (!convId) {
      setEvaluaciones([]);
      return;
    }
    setIsLoadingEvals(true);
    const res = await fetchEvaluacionesByConvocatoria(convId);
    if (res.error) {
      toast.error(res.error);
      setEvaluaciones([]);
    } else {
      setEvaluaciones(res.data);
    }
    setIsLoadingEvals(false);
  }, []);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (selectedConvId) {
      loadEvaluaciones(selectedConvId);
    }
  }, [selectedConvId, loadEvaluaciones]);

  const activeConvocatoria = useMemo(
    () => convocatorias.find((c) => c.id === selectedConvId) ?? null,
    [convocatorias, selectedConvId],
  );

  const stats = useMemo(() => computeCattellStats(evaluaciones), [evaluaciones]);

  const alreadyInvitedIds = useMemo(
    () => new Set(evaluaciones.map((e) => e.estudiante_id)),
    [evaluaciones],
  );

  const filteredEvaluaciones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return evaluaciones.filter((item) => {
      if (statFilter === "pendientes" && item.estado === "completado") return false;
      if (statFilter === "completados" && item.estado !== "completado") return false;
      if (statFilter === "apto" && item.dictamen !== "apto") return false;
      if (statFilter === "apto_con_observaciones" && item.dictamen !== "apto_con_observaciones")
        return false;
      if (statFilter === "no_apto" && item.dictamen !== "no_apto") return false;

      if (careerFilter !== "all" && item.estudiante_carrera !== careerFilter) {
        return false;
      }

      if (q) {
        const hay = [
          item.estudiante_nombre,
          item.estudiante_matricula ?? "",
          item.estudiante_email,
          item.estudiante_carrera ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [evaluaciones, statFilter, careerFilter, searchQuery]);

  // Estudiantes filtrados en el modal de selección
  const filteredModalEstudiantes = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    return estudiantes.filter((est) => {
      if (modalCareer !== "all" && est.carrera !== modalCareer) return false;
      if (q) {
        const hay = [est.nombre, est.matricula ?? "", est.email, est.carrera ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [estudiantes, modalCareer, modalSearch]);

  const handleCreateConvocatoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!newConvNombre.trim() || !newConvPeriodo.trim()) {
      toast.error("Indica el nombre y el periodo de la convocatoria Dual.");
      return;
    }

    setIsCreatingConv(true);
    const res = await createConvocatoriaDual({
      nombre: newConvNombre,
      periodo: newConvPeriodo,
      descripcion: newConvDesc,
      fecha_limite: newConvFechaLimite || null,
      creado_por: user.id,
    });
    setIsCreatingConv(false);

    if (res.error || !res.data) {
      toast.error(res.error || "No se pudo crear la convocatoria.");
      return;
    }

    toast.success(`Convocatoria "${res.data.nombre}" creada.`);
    setIsNewConvOpen(false);
    setNewConvDesc("");
    setConvocatorias((prev) => [res.data!, ...prev]);
    setSelectedConvId(res.data.id);
  };

  const handleToggleConvActiva = async () => {
    if (!activeConvocatoria) return;
    const nextState = !activeConvocatoria.activa;
    const res = await toggleConvocatoriaActiva(activeConvocatoria.id, nextState);
    if (!res.ok) {
      toast.error(res.error || "No se pudo actualizar el estado.");
      return;
    }
    setConvocatorias((prev) =>
      prev.map((c) => (c.id === activeConvocatoria.id ? { ...c, activa: nextState } : c)),
    );
    toast.success(nextState ? "Convocatoria activada." : "Convocatoria cerrada.");
  };

  const handleOpenSelectModal = () => {
    if (!selectedConvId) {
      toast.info("Primero crea o selecciona una convocatoria Dual.");
      return;
    }
    setSelectedIds(new Set());
    setModalSearch("");
    setModalCareer("all");
    setShowPasteMatriculas(false);
    setMatriculasInput("");
    setIsSelectModalOpen(true);
  };

  const toggleStudentSelection = (id: string) => {
    if (alreadyInvitedIds.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    const eligible = filteredModalEstudiantes.filter((e) => !alreadyInvitedIds.has(e.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = eligible.every((e) => next.has(e.id));
      if (allSelected) {
        eligible.forEach((e) => next.delete(e.id));
      } else {
        eligible.forEach((e) => next.add(e.id));
      }
      return next;
    });
  };

  const handleMatchMatriculas = () => {
    const tokens = matriculasInput
      .split(/[\s,;]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (tokens.length === 0) {
      toast.error("Pega al menos una matrícula para buscar.");
      return;
    }

    const tokenSet = new Set(tokens);
    let matchedCount = 0;
    let alreadyCount = 0;
    const matchedTokens = new Set<string>();

    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const est of estudiantes) {
        const mat = est.matricula?.trim().toLowerCase();
        if (mat && tokenSet.has(mat)) {
          matchedTokens.add(mat);
          if (alreadyInvitedIds.has(est.id)) {
            alreadyCount += 1;
          } else {
            next.add(est.id);
            matchedCount += 1;
          }
        }
      }
      return next;
    });

    const missingCount = [...tokenSet].filter((t) => !matchedTokens.has(t)).length;
    toast.success(
      `Seleccionados: ${matchedCount}. Ya habilitados: ${alreadyCount}. No encontrados: ${missingCount}.`,
    );
  };

  const handleConfirmEnableStudents = async () => {
    if (!selectedConvId || !user?.id || selectedIds.size === 0) return;
    setIsSavingSelection(true);
    const res = await habilitarEstudiantesCattell(selectedConvId, Array.from(selectedIds), user.id);
    setIsSavingSelection(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Prueba Cattell 16PF habilitada para ${res.insertedCount} aspirante(s) seleccionado(s).`,
    );
    setIsSelectModalOpen(false);
    await loadEvaluaciones(selectedConvId);
  };

  const handleCopyLink = async (record: EvaluacionCattellRecord) => {
    const url = `${window.location.origin}/cattell?token=${record.token_acceso}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Enlace copiado para ${record.estudiante_nombre}.`);
    } catch {
      toast.info(`Enlace directo: /cattell?token=${record.token_acceso}`);
    }
  };

  const handleRemovePending = async (record: EvaluacionCattellRecord) => {
    if (record.estado !== "pendiente") {
      toast.error("Solo pueden retirarse evaluaciones que aún están pendientes.");
      return;
    }
    const res = await removerAspirantePendiente(record.id);
    if (!res.ok) {
      toast.error(res.error || "No se pudo retirar al aspirante.");
      return;
    }
    toast.success(`${record.estudiante_nombre} fue retirado de esta convocatoria.`);
    setEvaluaciones((prev) => prev.filter((e) => e.id !== record.id));
  };

  const handleOpenProfile = (record: EvaluacionCattellRecord) => {
    setActiveProfile(record);
    setDictamenInput(
      record.dictamen !== "pendiente" ? record.dictamen : (record.pre_recomendacion ?? "apto"),
    );
    setObservacionesInput(record.observaciones_psicologo ?? "");
  };

  const handleSaveDictamen = async () => {
    if (!activeProfile || !user?.id) return;
    setIsSavingDictamen(true);
    const res = await guardarDictamenCattell(
      activeProfile.id,
      dictamenInput,
      observacionesInput,
      user.id,
    );
    setIsSavingDictamen(false);

    if (!res.ok) {
      toast.error(res.error || "No se pudo guardar el dictamen.");
      return;
    }

    toast.success(`Dictamen guardado para ${activeProfile.estudiante_nombre}.`);
    setEvaluaciones((prev) =>
      prev.map((e) =>
        e.id === activeProfile.id
          ? {
              ...e,
              dictamen: dictamenInput,
              observaciones_psicologo: observacionesInput.trim() || null,
              fecha_dictamen: new Date().toISOString(),
            }
          : e,
      ),
    );
    setActiveProfile(null);
  };

  const chartData = useMemo(() => {
    if (!activeProfile) return [];
    return CATTELL_FACTORS.map((f) => ({
      code: f.code,
      label: `${f.code} · ${f.name}`,
      decatipo: activeProfile.puntajes_decatipos[f.code as CattellFactorCode] ?? 0,
      bruto: activeProfile.puntajes_brutos[f.code as CattellFactorCode] ?? 0,
      lowPole: f.lowPole,
      highPole: f.highPole,
    }));
  }, [activeProfile]);

  const profileAutoNote = useMemo(() => {
    if (!activeProfile || activeProfile.estado !== "completado") return null;
    const dec = activeProfile.puntajes_decatipos as Record<CattellFactorCode, number>;
    const glob = activeProfile.factores_globales as Record<CattellGlobalCode, number>;
    return evaluarPreRecomendacionDual(dec, glob).resumenAutomatico;
  }, [activeProfile]);

  if (schemaError) {
    return (
      <div className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              Módulo Educación Dual (Cattell 16PF) pendiente de migración SQL
            </h2>
            <p className="text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">{schemaError}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={loadBaseData}
            className="shrink-0 gap-2 rounded-lg border-[#E5DFD3] text-xs font-semibold dark:border-[#2D3F2A]"
          >
            <RefreshCw className="size-3.5" />
            <span>Reintentar conexión</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de convocatoria y acciones principales */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E5DFD3] bg-white p-4 dark:border-[#2D3F2A] dark:bg-[#1A2618] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
            <Award className="size-4 shrink-0" />
            <span>Convocatoria Dual:</span>
          </div>
          <select
            aria-label="Seleccionar convocatoria Educación Dual"
            value={selectedConvId}
            onChange={(e) => setSelectedConvId(e.target.value)}
            disabled={isLoading || convocatorias.length === 0}
            className="h-9 min-w-[260px] rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-medium text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
          >
            {convocatorias.length === 0 ? (
              <option value="">Sin convocatorias creadas</option>
            ) : (
              convocatorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.periodo}) {c.activa ? "— Activa" : "— Cerrada"}
                </option>
              ))
            )}
          </select>

          {activeConvocatoria && (
            <button
              type="button"
              onClick={handleToggleConvActiva}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E5DFD3] px-3 text-xs font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#F5F1E8] dark:hover:bg-[#0F1A12]"
            >
              <span>{activeConvocatoria.activa ? "Cerrar convocatoria" : "Reactivar"}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsNewConvOpen(true)}
            className="h-9 shrink-0 gap-1.5 whitespace-nowrap rounded-lg border-[#E5DFD3] bg-white px-3.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#1A2618]"
          >
            <Plus className="size-3.5" />
            <span>Nueva convocatoria</span>
          </Button>
          <Button
            type="button"
            onClick={handleOpenSelectModal}
            disabled={!selectedConvId}
            className="h-9 shrink-0 gap-1.5 whitespace-nowrap rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
          >
            <UserPlus className="size-3.5" />
            <span>Seleccionar aspirantes</span>
          </Button>
        </div>
      </div>

      {/* 6 Tarjetas KPI de conteo en tiempo real (actúan como filtro rápido) */}
      <section
        aria-label="Conteo de aspirantes Dual Cattell"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        {(
          [
            {
              key: "todos",
              label: "Habilitados",
              value: stats.totalHabilitados,
              sub: "Total seleccionados",
              tone: "text-[#1A1A1A] dark:text-[#F5F1E8]",
            },
            {
              key: "pendientes",
              label: "Sin concluir",
              value: stats.pendientes + stats.enProgreso,
              sub: `${stats.pendientes} pend. · ${stats.enProgreso} en curso`,
              tone: "text-[#D97706] dark:text-[#FCD34D]",
            },
            {
              key: "completados",
              label: "Completados",
              value: stats.completados,
              sub: `${stats.dictamenPendiente} por dictaminar`,
              tone: "text-[#1F4D2C] dark:text-[#8FC9B5]",
            },
            {
              key: "apto",
              label: "Aptos",
              value: stats.aptos,
              sub: "Dictamen favorable",
              tone: "text-[#16A34A] dark:text-[#8FC9B5]",
            },
            {
              key: "apto_con_observaciones",
              label: "Con observ.",
              value: stats.aptoConObservaciones,
              sub: "Seguimiento sugerido",
              tone: "text-[#D97706] dark:text-[#FCD34D]",
            },
            {
              key: "no_apto",
              label: "No aptos",
              value: stats.noAptos,
              sub: "No recomendados",
              tone: "text-[#DC2626] dark:text-[#FCA5A5]",
            },
          ] as const
        ).map((kpi) => {
          const active = statFilter === kpi.key;
          return (
            <button
              key={kpi.key}
              type="button"
              onClick={() => setStatFilter(kpi.key)}
              className={`rounded-lg border bg-white p-3.5 text-left transition-colors dark:bg-[#1A2618] ${
                active
                  ? "border-[#1F4D2C] ring-2 ring-[#1F4D2C]/20"
                  : "border-[#E5DFD3] hover:border-[#1F4D2C]/50 dark:border-[#2D3F2A]"
              }`}
            >
              <span className="block text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                {kpi.label}
              </span>
              <span className={`mt-1 block text-2xl font-bold tabular-nums ${kpi.tone}`}>
                {kpi.value}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                {kpi.sub}
              </span>
            </button>
          );
        })}
      </section>

      {/* Filtros de búsqueda y carrera */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6B6B6B]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar aspirante por nombre, matrícula o correo..."
              className="h-9 rounded-lg border-[#E5DFD3] bg-white pl-9 text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
            />
          </div>

          <select
            aria-label="Filtrar por carrera"
            value={careerFilter}
            onChange={(e) => setCareerFilter(e.target.value)}
            className="h-9 rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-medium text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
          >
            <option value="all">Todas las carreras</option>
            {TESH_CAREERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
          <span className="tabular-nums font-medium">
            {filteredEvaluaciones.length} de {evaluaciones.length} aspirantes
          </span>
          {(statFilter !== "todos" || careerFilter !== "all" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setStatFilter("todos");
                setCareerFilter("all");
                setSearchQuery("");
              }}
              className="font-semibold text-[#1F4D2C] hover:underline dark:text-[#8FC9B5]"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla principal de aspirantes habilitados */}
      {isLoading || isLoadingEvals ? (
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-10 text-center text-sm text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A6B5A3]">
          Cargando información del Programa Dual...
        </div>
      ) : convocatorias.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#E5DFD3] bg-white p-12 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <Users className="size-8 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              Crea tu primera convocatoria de Educación Dual
            </h3>
            <p className="max-w-md text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Habilita la prueba Cattell (16PF) únicamente para los estudiantes seleccionados de
              cualquier carrera del TESH y emite su dictamen de aptitud.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsNewConvOpen(true)}
            className="mt-1 h-9 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
          >
            Nueva convocatoria Dual
          </Button>
        </div>
      ) : filteredEvaluaciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#E5DFD3] bg-white p-12 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <ListChecks className="size-8 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              {evaluaciones.length === 0
                ? "Aún no hay aspirantes seleccionados en esta convocatoria"
                : "Sin coincidencias con los filtros actuales"}
            </h3>
            <p className="max-w-md text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              {evaluaciones.length === 0
                ? "Selecciona estudiantes de una o varias carreras para habilitarles el cuestionario Cattell 16PF."
                : "Ajusta la carrera, estado o término de búsqueda para ver más registros."}
            </p>
          </div>
          {evaluaciones.length === 0 && (
            <Button
              type="button"
              onClick={handleOpenSelectModal}
              className="mt-1 h-9 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
            >
              Seleccionar aspirantes
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5DFD3] bg-[#F5F1E8]/60 text-[11px] font-semibold text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
                <th className="px-4 py-3">Aspirante</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Carrera</th>
                <th className="px-4 py-3">Estado prueba</th>
                <th className="px-4 py-3">Dictamen Dual</th>
                <th className="px-4 py-3">Enlace</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
              {filteredEvaluaciones.map((row) => {
                const dict = DICTAMEN_LABELS[row.dictamen];
                return (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-[#F5F1E8]/40 dark:hover:bg-[#0F1A12]/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {row.estudiante_nombre}
                      </p>
                      <p className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                        {row.estudiante_email}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {row.estudiante_matricula || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#1A1A1A] dark:text-[#F5F1E8]">
                      <span>{row.estudiante_carrera || "Sin carrera"}</span>
                      {row.estudiante_semestre && (
                        <span className="text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {" "}
                          · {row.estudiante_semestre}º
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.estado === "completado" ? (
                        <span className="font-medium text-[#16A34A] dark:text-[#8FC9B5]">
                          Completado · {formatShortDate(row.fecha_completado)}
                        </span>
                      ) : row.estado === "en_progreso" ? (
                        <span className="font-medium tabular-nums text-[#D97706] dark:text-[#FCD34D]">
                          En progreso ({row.reactivos_respondidos}/{row.total_reactivos})
                        </span>
                      ) : (
                        <span className="text-[#6B6B6B] dark:text-[#A6B5A3]">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={dict.className}>{dict.label}</span>
                      {row.dictamen === "pendiente" && row.pre_recomendacion && (
                        <span className="block text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Sugerido: {DICTAMEN_LABELS[row.pre_recomendacion].label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(row)}
                        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md border border-[#E5DFD3] px-2.5 text-[11px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#F5F1E8] dark:hover:bg-[#0F1A12]"
                      >
                        <Copy className="size-3" />
                        <span>Copiar enlace</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {row.estado === "completado" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenProfile(row)}
                            className="h-8 gap-1.5 whitespace-nowrap rounded-md bg-[#1F4D2C] px-3 text-[11px] font-semibold text-white hover:bg-[#4A7C59]"
                          >
                            <FileBarChart2 className="size-3.5" />
                            <span>Ver perfil 16PF</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemovePending(row)}
                            disabled={row.estado !== "pendiente"}
                            title={
                              row.estado === "pendiente"
                                ? "Retirar invitación pendiente"
                                : "El estudiante ya inició la prueba"
                            }
                            className="h-8 gap-1 px-2 text-[11px] text-[#6B6B6B] hover:text-[#DC2626] dark:text-[#A6B5A3]"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Retirar</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog: Nueva Convocatoria Dual */}
      <Dialog open={isNewConvOpen} onOpenChange={setIsNewConvOpen}>
        <DialogContent className="max-w-md rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              Nueva convocatoria Educación Dual
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Crea una cohorte para agrupar a los aspirantes seleccionados de las distintas carreras
              del TESH.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateConvocatoria} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="conv-nombre" className="text-xs font-semibold">
                Nombre de la convocatoria
              </Label>
              <Input
                id="conv-nombre"
                value={newConvNombre}
                onChange={(e) => setNewConvNombre(e.target.value)}
                placeholder="Programa Educación Dual 2026-2"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="conv-periodo" className="text-xs font-semibold">
                  Periodo escolar
                </Label>
                <Input
                  id="conv-periodo"
                  value={newConvPeriodo}
                  onChange={(e) => setNewConvPeriodo(e.target.value)}
                  placeholder="2026-2"
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conv-fecha" className="text-xs font-semibold">
                  Fecha límite (opcional)
                </Label>
                <Input
                  id="conv-fecha"
                  type="date"
                  value={newConvFechaLimite}
                  onChange={(e) => setNewConvFechaLimite(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="conv-desc" className="text-xs font-semibold">
                Observaciones de convocatoria (opcional)
              </Label>
              <Textarea
                id="conv-desc"
                value={newConvDesc}
                onChange={(e) => setNewConvDesc(e.target.value)}
                placeholder="Ej. Aspirantes preseleccionados de 7º y 8º semestre para vinculación empresarial."
                rows={2}
                className="text-xs"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewConvOpen(false)}
                className="h-9 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isCreatingConv}
                className="h-9 bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
              >
                {isCreatingConv ? "Creando..." : "Crear convocatoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Seleccionar Aspirantes (todas las carreras o pegando matrículas) */}
      <Dialog open={isSelectModalOpen} onOpenChange={setIsSelectModalOpen}>
        <DialogContent className="max-w-3xl rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              Seleccionar aspirantes para prueba Cattell (16PF)
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Solo los estudiantes seleccionados verán habilitada la evaluación en su cuenta y
              podrán acceder mediante su enlace personal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6B6B6B]" />
                <Input
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Buscar por nombre, matrícula o correo..."
                  className="h-9 pl-9 text-xs"
                />
              </div>

              <select
                aria-label="Filtrar aspirantes por carrera"
                value={modalCareer}
                onChange={(e) => setModalCareer(e.target.value)}
                className="h-9 rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-medium dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
              >
                <option value="all">Todas las carreras</option>
                {TESH_CAREERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasteMatriculas((v) => !v)}
                className="h-9 shrink-0 whitespace-nowrap text-xs font-semibold"
              >
                Pegar matrículas
              </Button>
            </div>

            {showPasteMatriculas && (
              <div className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <Label htmlFor="paste-matriculas" className="text-xs font-semibold">
                  Pega matrículas separadas por salto de línea, coma o espacio
                </Label>
                <Textarea
                  id="paste-matriculas"
                  value={matriculasInput}
                  onChange={(e) => setMatriculasInput(e.target.value)}
                  placeholder={"202310452\n202310489, 202310510"}
                  rows={2}
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleMatchMatriculas}
                    className="h-8 bg-[#1F4D2C] text-xs text-white hover:bg-[#4A7C59]"
                  >
                    Marcar coincidencias
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              <span className="tabular-nums">
                {filteredModalEstudiantes.length} estudiantes encontrados · {selectedIds.size}{" "}
                seleccionados nuevos
              </span>
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="font-semibold text-[#1F4D2C] hover:underline dark:text-[#8FC9B5]"
              >
                Alternar visibles
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-[#E5DFD3] divide-y divide-[#E5DFD3] dark:border-[#2D3F2A] dark:divide-[#2D3F2A]">
              {filteredModalEstudiantes.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                  No se encontraron estudiantes con esos criterios.
                </div>
              ) : (
                filteredModalEstudiantes.map((est) => {
                  const yaHabilitado = alreadyInvitedIds.has(est.id);
                  const checked = yaHabilitado || selectedIds.has(est.id);
                  return (
                    <label
                      key={est.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs ${
                        yaHabilitado
                          ? "cursor-not-allowed bg-[#F5F1E8]/40 opacity-65 dark:bg-[#0F1A12]/50"
                          : "cursor-pointer hover:bg-[#F5F1E8]/50 dark:hover:bg-[#0F1A12]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Checkbox
                          checked={checked}
                          disabled={yaHabilitado}
                          onCheckedChange={() => toggleStudentSelection(est.id)}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {est.nombre}
                          </p>
                          <p className="truncate text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {est.carrera || "Sin carrera"}
                            {est.semestre ? ` · ${est.semestre}º` : ""}
                            {est.grupo ? ` · Gpo ${est.grupo}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono tabular-nums text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {est.matricula || "Sin matrícula"}
                        </span>
                        {yaHabilitado && (
                          <span className="text-[11px] font-semibold text-[#16A34A] dark:text-[#8FC9B5]">
                            Ya habilitado
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSelectModalOpen(false)}
              className="h-9 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmEnableStudents}
              disabled={selectedIds.size === 0 || isSavingSelection}
              className="h-9 bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
            >
              {isSavingSelection ? "Habilitando..." : `Habilitar prueba 16PF (${selectedIds.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Perfil 16PF (16 factores + 5 globales) y Dictamen Psicológico */}
      <Dialog
        open={activeProfile !== null}
        onOpenChange={(open) => {
          if (!open) setActiveProfile(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          {activeProfile && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Perfil Psicométrico Cattell (16PF) — {activeProfile.estudiante_nombre}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Matrícula {activeProfile.estudiante_matricula || "N/D"} ·{" "}
                  {activeProfile.estudiante_carrera || "Sin carrera"} · Completado el{" "}
                  {formatShortDate(activeProfile.fecha_completado)}
                </DialogDescription>
              </DialogHeader>

              {/* 5 Dimensiones Globales */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Dimensiones Globales (Decatipos 1–10)
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {CATTELL_GLOBAL_META.map((g) => {
                    const score = activeProfile.factores_globales[g.code] ?? 5;
                    return (
                      <div
                        key={g.code}
                        className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/40 p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {g.name}
                          </span>
                          <span className="font-mono text-base font-bold tabular-nums text-[#1F4D2C] dark:text-[#8FC9B5]">
                            {score}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
                          <div
                            className="h-full bg-[#1F4D2C] dark:bg-[#8FC9B5]"
                            style={{ width: `${score * 10}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Gráfica de 16 Factores Primarios */}
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Perfil de 16 Factores Primarios (Franja promedio 4–7)
                  </h3>
                  <span className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Escala decatipo de 1 (polo bajo) a 10 (polo alto)
                  </span>
                </div>

                <div className="h-[420px] w-full rounded-lg border border-[#E5DFD3] bg-white p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 8, right: 20, left: 10, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis
                        type="number"
                        domain={[0, 10]}
                        ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                      />
                      <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} />
                      <ReferenceArea x1={4} x2={7} fill="#8FC9B5" fillOpacity={0.18} />
                      <Tooltip
                        formatter={(value: number) => [`Decatipo ${value}/10`, "Puntaje"]}
                        labelFormatter={(label) => String(label)}
                      />
                      <Bar dataKey="decatipo" radius={[0, 4, 4, 0]} barSize={14}>
                        {chartData.map((entry) => {
                          let fill = "#1F4D2C";
                          if (entry.decatipo <= 3) fill = "#D97706";
                          else if (entry.decatipo >= 8) fill = "#4A7C59";
                          return <Cell key={entry.code} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Pre-recomendación orientativa + Dictamen del psicólogo */}
              <section className="space-y-4 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/40 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                {profileAutoNote && (
                  <p className="text-xs leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                    <span className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Análisis orientativo:{" "}
                    </span>
                    {profileAutoNote}
                  </p>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Dictamen oficial del área de Psicología
                  </Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        { value: "apto", label: "Apto para Programa Dual" },
                        {
                          value: "apto_con_observaciones",
                          label: "Apto con observaciones",
                        },
                        { value: "no_apto", label: "No apto" },
                      ] as const
                    ).map((opt) => {
                      const active = dictamenInput === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDictamenInput(opt.value)}
                          className={`flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                            active
                              ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
                              : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
                          }`}
                        >
                          {active && <CheckCircle2 className="size-3.5 shrink-0" />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dictamen-obs" className="text-xs font-semibold">
                    Observaciones clínicas / recomendaciones para entrevista Dual
                  </Label>
                  <Textarea
                    id="dictamen-obs"
                    value={observacionesInput}
                    onChange={(e) => setObservacionesInput(e.target.value)}
                    placeholder="Notas de entrevista, fortalezas detectadas o recomendaciones de acompañamiento..."
                    rows={3}
                    className="bg-white text-xs dark:bg-[#1A2618]"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveProfile(null)}
                    className="h-9 text-xs"
                  >
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveDictamen}
                    disabled={isSavingDictamen}
                    className="h-9 gap-1.5 bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                  >
                    <ClipboardCheck className="size-3.5" />
                    <span>{isSavingDictamen ? "Guardando..." : "Guardar dictamen"}</span>
                  </Button>
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
