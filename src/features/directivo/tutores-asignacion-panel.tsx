import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CalendarRange,
  CheckCircle2,
  Copy,
  Grid3X3,
  Plus,
  RefreshCw,
  Save,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TESH_PERIODOS_SUGERIDOS,
  TESH_TUTORIAS_CARRERAS,
  copyTutorAssignmentsFromPreviousPeriod,
  getAllStudentsForDirectivo,
  getAllTutorGroupAssignments,
  getPreviousPeriodo,
  getTutorProfiles,
  saveBulkTutorAssignments,
  updateStudentAcademicGroup,
  updateTutorAssignment,
  type TutorGrupoAssignment,
  type TutorProfile,
  type TutorStudentItem,
} from "@/features/tutor/tutor-service";

type PanelTab = "asignaciones" | "estudiantes";

interface GridRowItem {
  key: string;
  carrera: string;
  semestre: string;
  grupo: string;
}

const SEMESTRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function makeGridKey(carrera: string, semestre: string, grupo: string): string {
  return `${carrera.trim().toLowerCase()}|${semestre.trim()}|${grupo.trim().toLowerCase()}`;
}

export function TutoresAsignacionPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>("asignaciones");

  const [tutores, setTutores] = useState<TutorProfile[]>([]);
  const [allAsignaciones, setAllAsignaciones] = useState<TutorGrupoAssignment[]>([]);
  const [estudiantes, setEstudiantes] = useState<TutorStudentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selector de periodo académico
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("2026-2");
  const [customPeriodoInput, setCustomPeriodoInput] = useState("");
  const [showCustomPeriodo, setShowCustomPeriodo] = useState(false);
  const [showInactiveRows, setShowInactiveRows] = useState(false);
  const [isCopyingPeriod, setIsCopyingPeriod] = useState(false);

  // Grilla de asignación masiva
  const [showBulkGrid, setShowBulkGrid] = useState(true);
  const [groupsPerSemester, setGroupsPerSemester] = useState<1 | 2 | 3>(1);
  const [gridCareerFilter, setGridCareerFilter] = useState<string>("all");
  const [gridSemesterFilter, setGridSemesterFilter] = useState<string>("all");
  const [gridOnlyUnassigned, setGridOnlyUnassigned] = useState(false);
  const [gridSelections, setGridSelections] = useState<Record<string, string>>({});
  const [extraGroups, setExtraGroups] = useState<GridRowItem[]>([]);
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Gestión de estudiantes que recursan
  const [studentSearch, setStudentSearch] = useState("");
  const [studentCareerFilter, setStudentCareerFilter] = useState<string>("all");
  const [editingStudent, setEditingStudent] = useState<TutorStudentItem | null>(null);
  const [editCarrera, setEditCarrera] = useState<string>(TESH_TUTORIAS_CARRERAS[0]);
  const [editSemestre, setEditSemestre] = useState<string>("1");
  const [editGrupo, setEditGrupo] = useState<string>("101");
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profiles, groupAssignments, studentsList] = await Promise.all([
        getTutorProfiles(),
        getAllTutorGroupAssignments(),
        getAllStudentsForDirectivo(),
      ]);
      setTutores(profiles);
      setAllAsignaciones(groupAssignments);
      setEstudiantes(studentsList);
    } catch {
      toast.error("No se pudieron cargar los datos de asignaciones y tutorías.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const availablePeriodos = useMemo(() => {
    const set = new Set<string>([...TESH_PERIODOS_SUGERIDOS]);
    allAsignaciones.forEach((a) => {
      if (a.periodo) set.add(a.periodo);
    });
    if (selectedPeriodo) set.add(selectedPeriodo);
    return Array.from(set).sort();
  }, [allAsignaciones, selectedPeriodo]);

  const previousPeriodo = useMemo(() => getPreviousPeriodo(selectedPeriodo), [selectedPeriodo]);

  const periodAssignments = useMemo(() => {
    return allAsignaciones
      .filter((a) => (a.periodo || "2026-2") === selectedPeriodo)
      .sort((a, b) => {
        const c = a.carrera.localeCompare(b.carrera, "es");
        if (c !== 0) return c;
        const s = Number(a.semestre) - Number(b.semestre);
        if (!isNaN(s) && s !== 0) return s;
        return a.grupo.localeCompare(b.grupo, "es");
      });
  }, [allAsignaciones, selectedPeriodo]);

  const activePeriodAssignments = useMemo(
    () => periodAssignments.filter((a) => a.activo !== false),
    [periodAssignments],
  );

  const visiblePeriodAssignments = useMemo(
    () => (showInactiveRows ? periodAssignments : activePeriodAssignments),
    [showInactiveRows, periodAssignments, activePeriodAssignments],
  );

  const previousPeriodHasAssignments = useMemo(() => {
    return allAsignaciones.some((a) => (a.periodo || "2026-2") === previousPeriodo);
  }, [allAsignaciones, previousPeriodo]);

  const syncGridWithSelectedPeriod = useCallback(
    (sourceAssignments: TutorGrupoAssignment[]) => {
      const nextSelections: Record<string, string> = {};
      const extras: GridRowItem[] = [];
      const standardSet = new Set<string>();

      for (const career of TESH_TUTORIAS_CARRERAS) {
        for (const sem of SEMESTRES) {
          for (let gIdx = 1; gIdx <= groupsPerSemester; gIdx++) {
            const grp = `${sem}0${gIdx}`;
            standardSet.add(makeGridKey(career, sem, grp));
          }
        }
      }

      sourceAssignments
        .filter((a) => a.activo !== false)
        .forEach((a) => {
          const k = makeGridKey(a.carrera, a.semestre, a.grupo);
          nextSelections[k] = a.tutor_id;
          if (!standardSet.has(k)) {
            extras.push({
              key: k,
              carrera: a.carrera,
              semestre: a.semestre,
              grupo: a.grupo,
            });
          }
        });

      setGridSelections(nextSelections);
      setExtraGroups(extras);
    },
    [groupsPerSemester],
  );

  useEffect(() => {
    syncGridWithSelectedPeriod(periodAssignments);
  }, [selectedPeriodo, periodAssignments, syncGridWithSelectedPeriod]);

  const allGridRows = useMemo<GridRowItem[]>(() => {
    const rows: GridRowItem[] = [];
    const seenKeys = new Set<string>();

    for (const carrera of TESH_TUTORIAS_CARRERAS) {
      for (const sem of SEMESTRES) {
        for (let gIdx = 1; gIdx <= groupsPerSemester; gIdx++) {
          const grupo = `${sem}0${gIdx}`;
          const key = makeGridKey(carrera, sem, grupo);
          seenKeys.add(key);
          rows.push({ key, carrera, semestre: sem, grupo });
        }
      }
    }

    for (const extra of extraGroups) {
      if (!seenKeys.has(extra.key)) {
        seenKeys.add(extra.key);
        rows.push(extra);
      }
    }

    return rows.sort((a, b) => {
      const c = a.carrera.localeCompare(b.carrera, "es");
      if (c !== 0) return c;
      const s = Number(a.semestre) - Number(b.semestre);
      if (!isNaN(s) && s !== 0) return s;
      return a.grupo.localeCompare(b.grupo, "es");
    });
  }, [groupsPerSemester, extraGroups]);

  const filteredGridRows = useMemo(() => {
    return allGridRows.filter((row) => {
      if (gridCareerFilter !== "all" && row.carrera !== gridCareerFilter) return false;
      if (gridSemesterFilter !== "all" && row.semestre !== gridSemesterFilter) return false;
      if (gridOnlyUnassigned && gridSelections[row.key]) return false;
      return true;
    });
  }, [allGridRows, gridCareerFilter, gridSemesterFilter, gridOnlyUnassigned, gridSelections]);

  const selectedGridEntries = useMemo(() => {
    return allGridRows
      .filter((row) => Boolean(gridSelections[row.key]))
      .map((row) => {
        const tutorId = gridSelections[row.key];
        const tutor = tutores.find((t) => t.id === tutorId);
        return {
          ...row,
          tutor_id: tutorId,
          tutor_nombre: tutor?.nombre || "Tutor TESH",
        };
      });
  }, [allGridRows, gridSelections, tutores]);

  const handleOpenCreateFromScratch = () => {
    setShowBulkGrid(true);
    setGridSelections({});
    setGridCareerFilter("all");
    setGridSemesterFilter("all");
    setGridOnlyUnassigned(false);
    setTimeout(() => {
      document
        .getElementById("asignacion-masiva-grid")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const handleCopyFromPreviousPeriod = async () => {
    setIsCopyingPeriod(true);
    try {
      const res = await copyTutorAssignmentsFromPreviousPeriod({
        targetPeriodo: selectedPeriodo,
        sourcePeriodo: previousPeriodo,
      });

      if (!res.ok) {
        toast.error(res.error || `No se encontraron asignaciones en ${previousPeriodo}.`);
        return;
      }

      toast.success(
        `Se copiaron ${res.copiedCount} asignaciones de ${res.sourcePeriodo} a ${selectedPeriodo}. El periodo anterior quedó inactivo.`,
      );
      setShowBulkGrid(true);
      await loadAll();
    } finally {
      setIsCopyingPeriod(false);
    }
  };

  const handleSaveBulkAssignments = async () => {
    if (selectedGridEntries.length === 0) {
      toast.error("Selecciona al menos un tutor en la grilla para guardar.");
      return;
    }

    setIsSavingBulk(true);
    try {
      const res = await saveBulkTutorAssignments({
        periodo: selectedPeriodo,
        assignments: selectedGridEntries.map((item) => ({
          tutor_id: item.tutor_id,
          tutor_nombre: item.tutor_nombre,
          carrera: item.carrera,
          semestre: item.semestre,
          grupo: item.grupo,
        })),
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudieron guardar las asignaciones.");
        return;
      }

      toast.success(
        `${res.savedCount} asignaciones guardadas en el periodo ${selectedPeriodo}. Las asignaciones previas de esos grupos se marcaron como inactivas.`,
      );
      await loadAll();
    } finally {
      setIsSavingBulk(false);
    }
  };

  const handleInlineTutorChange = async (asig: TutorGrupoAssignment, nextTutorId: string) => {
    const tutor = tutores.find((t) => t.id === nextTutorId);
    if (!tutor) return;
    const res = await updateTutorAssignment({
      id: asig.id,
      tutor_id: tutor.id,
      tutor_nombre: tutor.nombre,
    });
    if (!res.ok) {
      toast.error(res.error || "No se pudo cambiar el tutor.");
      return;
    }
    toast.success(`Grupo ${asig.grupo} (${asig.carrera}) actualizado a ${tutor.nombre}.`);
    await loadAll();
  };

  const handleToggleAssignmentActive = async (asig: TutorGrupoAssignment) => {
    const nextActivo = asig.activo === false;
    const res = await updateTutorAssignment({
      id: asig.id,
      activo: nextActivo,
    });
    if (!res.ok) {
      toast.error(res.error || "No se pudo actualizar el estado.");
      return;
    }
    toast.success(
      nextActivo
        ? `Asignación de ${asig.carrera} · Grupo ${asig.grupo} reactivada.`
        : `Asignación de ${asig.carrera} · Grupo ${asig.grupo} marcada como inactiva.`,
    );
    await loadAll();
  };

  const handleAddCustomPeriodo = () => {
    const clean = customPeriodoInput.trim();
    if (!clean) return;
    setSelectedPeriodo(clean);
    setCustomPeriodoInput("");
    setShowCustomPeriodo(false);
  };

  // Filtrado de estudiantes para la pestaña "Estudiantes" (recursamiento)
  const filteredEstudiantes = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return estudiantes.filter((st) => {
      const matchesCareer = studentCareerFilter === "all" || st.carrera === studentCareerFilter;
      const matchesQuery =
        q === "" || st.nombre.toLowerCase().includes(q) || st.matricula.toLowerCase().includes(q);
      return matchesCareer && matchesQuery;
    });
  }, [estudiantes, studentSearch, studentCareerFilter]);

  const handleOpenEditStudent = (st: TutorStudentItem) => {
    setEditingStudent(st);
    setEditCarrera(st.carrera || TESH_TUTORIAS_CARRERAS[0]);
    setEditSemestre(String(st.semestre || "1").replace(/\D/g, "") || "1");
    setEditGrupo(st.grupo || "101");
  };

  const handleSaveStudentGroupChange = async () => {
    if (!editingStudent) return;
    if (!editGrupo.trim()) {
      toast.error("Ingresa el grupo destino del estudiante.");
      return;
    }

    setIsUpdatingStudent(true);
    try {
      const res = await updateStudentAcademicGroup({
        studentId: editingStudent.id,
        carrera: editCarrera,
        semestre: editSemestre,
        grupo: editGrupo.trim(),
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudo cambiar el grupo del estudiante.");
        return;
      }

      toast.success(
        `${editingStudent.nombre} ahora pertenece a ${editCarrera} · ${editSemestre}º Sem · Grupo ${editGrupo.trim()}.`,
      );
      setEditingStudent(null);
      await loadAll();
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const selectControlClassName =
    "h-10 w-full rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-semibold text-[#1A1A1A] focus:border-[#1F4D2C] focus:ring-2 focus:ring-[#1F4D2C]/20 focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]";

  return (
    <div className="space-y-6">
      {/* Cabecera de sección */}
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
            Asignar tutores por periodo y recursamiento
          </h2>
          <p className="mt-1 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A8B5A0]">
            Administra las 7 carreras del TESH, semestres 1º al 9º (1–3 grupos por semestre), copia
            entre periodos y reubica a estudiantes que recursan.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadAll}
          className="h-10 w-fit shrink-0 whitespace-nowrap"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar datos
        </Button>
      </div>

      {/* Pestañas del módulo */}
      <div
        role="tablist"
        aria-label="Secciones de asignación de tutores"
        className="flex flex-wrap items-center gap-2 border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "asignaciones"}
          onClick={() => setActiveTab("asignaciones")}
          className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-xs font-semibold transition-colors ${
            activeTab === "asignaciones"
              ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
              : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:hover:bg-[#223120]"
          }`}
        >
          <CalendarRange className="size-4" />
          Asignaciones por periodo
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "estudiantes"}
          onClick={() => setActiveTab("estudiantes")}
          className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-xs font-semibold transition-colors ${
            activeTab === "estudiantes"
              ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
              : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:hover:bg-[#223120]"
          }`}
        >
          <Users className="size-4" />
          Estudiantes
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
              activeTab === "estudiantes"
                ? "bg-white/20 text-white"
                : "bg-[#F5F1E8] text-[#1F4D2C] dark:bg-[#0F1A12] dark:text-[#8FC9B5]"
            }`}
          >
            {estudiantes.length}
          </span>
        </button>
      </div>

      {activeTab === "asignaciones" && (
        <div className="space-y-6">
          {/* 1. VISTA DE ASIGNACIONES POR PERIODO */}
          <section className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 space-y-1.5">
                  <Label
                    htmlFor="directivo-periodo-select"
                    className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                  >
                    Periodo académico
                  </Label>
                  <select
                    id="directivo-periodo-select"
                    value={selectedPeriodo}
                    onChange={(e) => setSelectedPeriodo(e.target.value)}
                    className={selectControlClassName}
                  >
                    {availablePeriodos.map((p) => (
                      <option key={p} value={p}>
                        Periodo {p}
                      </option>
                    ))}
                  </select>
                </div>

                {!showCustomPeriodo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomPeriodo(true)}
                    className="h-10 shrink-0 whitespace-nowrap"
                  >
                    <Plus className="size-4" />
                    Otro periodo
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={customPeriodoInput}
                      onChange={(e) => setCustomPeriodoInput(e.target.value)}
                      placeholder="Ej. 2028-1"
                      className="h-10 w-28 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddCustomPeriodo}
                      className="h-10"
                    >
                      Aplicar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCustomPeriodo(false)}
                      className="h-10"
                    >
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="accent"
                  disabled={isCopyingPeriod}
                  onClick={handleCopyFromPreviousPeriod}
                  className="h-10 shrink-0 whitespace-nowrap text-xs"
                >
                  <Copy className="size-4" />
                  {isCopyingPeriod
                    ? "Copiando..."
                    : `Copiar del periodo anterior (${previousPeriodo})`}
                </Button>

                <Button
                  type="button"
                  onClick={() => setShowBulkGrid((prev) => !prev)}
                  className="h-10 shrink-0 whitespace-nowrap text-xs"
                >
                  <Grid3X3 className="size-4" />
                  {showBulkGrid ? "Ocultar grilla masiva" : "Abrir asignación masiva"}
                </Button>
              </div>
            </div>

            {/* Resumen del periodo */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DFD3] pt-3 text-xs dark:border-[#2D3F2A]">
              <div className="flex flex-wrap items-center gap-2 text-[#6B6B6B] dark:text-[#A8B5A0]">
                <span className="font-semibold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                  {activePeriodAssignments.length} activas en {selectedPeriodo}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {tutores.length} tutores disponibles (rol=&apos;tutor&apos;)
                </span>
                {previousPeriodHasAssignments && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Al guardar o copiar nuevas asignaciones, las anteriores del mismo grupo pasan
                      a inactivas.
                    </span>
                  </>
                )}
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#6B6B6B] dark:text-[#A8B5A0]">
                <input
                  type="checkbox"
                  checked={showInactiveRows}
                  onChange={(e) => setShowInactiveRows(e.target.checked)}
                  className="size-4 rounded border-[#E5DFD3] accent-[#1F4D2C]"
                />
                Mostrar inactivas
              </label>
            </div>

            {/* Tabla de asignaciones del periodo */}
            {isLoading ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-11 animate-pulse rounded-lg bg-[#F5F1E8] dark:bg-[#0F1A12]"
                  />
                ))}
              </div>
            ) : visiblePeriodAssignments.length === 0 ? (
              <div className="space-y-4 rounded-lg border border-dashed border-[#E5DFD3] bg-[#F5F1E8]/50 p-8 text-center dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60">
                <div>
                  <p className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    No hay asignaciones activas registradas para el periodo {selectedPeriodo}.
                  </p>
                  <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
                    Inicializa las carreras y grupos en la grilla de asignación masiva o copia las
                    asignaciones vigentes del periodo anterior ({previousPeriodo}).
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    onClick={handleOpenCreateFromScratch}
                    className="h-10 shrink-0 whitespace-nowrap text-xs"
                  >
                    <Plus className="size-4" />
                    Crear asignaciones desde cero
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCopyingPeriod || !previousPeriodHasAssignments}
                    onClick={handleCopyFromPreviousPeriod}
                    className="h-10 shrink-0 whitespace-nowrap text-xs"
                  >
                    <Copy className="size-4" />
                    Copiar del periodo anterior ({previousPeriodo})
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#E5DFD3] bg-[#F5F1E8] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:hover:bg-[#0F1A12]">
                      <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Carrera
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Semestre
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Grupo
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Tutor asignado
                      </TableHead>
                      <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Estado
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Acción
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePeriodAssignments.map((asig) => {
                      const isActive = asig.activo !== false;
                      return (
                        <TableRow
                          key={asig.id}
                          className={`border-[#E5DFD3] hover:bg-[#F5F1E8]/50 dark:border-[#2D3F2A] dark:hover:bg-[#0F1A12]/50 ${
                            !isActive ? "opacity-65" : ""
                          }`}
                        >
                          <TableCell className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {asig.carrera}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
                            {asig.semestre}º Semestre
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs tabular-nums">
                              {asig.grupo}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <select
                              aria-label={`Cambiar tutor para ${asig.carrera} grupo ${asig.grupo}`}
                              value={asig.tutor_id}
                              disabled={!isActive}
                              onChange={(e) => handleInlineTutorChange(asig, e.target.value)}
                              className="h-9 max-w-64 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1A1A1A] focus:border-[#1F4D2C] focus:outline-none disabled:opacity-60 dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                            >
                              {!tutores.some((t) => t.id === asig.tutor_id) && (
                                <option value={asig.tutor_id}>
                                  {asig.tutor_nombre || asig.tutor_id}
                                </option>
                              )}
                              {tutores.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nombre}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            {isActive ? (
                              <Badge variant="primary" className="text-[11px]">
                                Activa
                              </Badge>
                            ) : (
                              <Badge variant="neutral" className="text-[11px]">
                                Inactiva
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleAssignmentActive(asig)}
                              className="h-8 text-xs"
                            >
                              {isActive ? "Desactivar" : "Reactivar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* 2. GRILLA DE ASIGNACIÓN MASIVA */}
          {showBulkGrid && (
            <section
              id="asignacion-masiva-grid"
              className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
            >
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div className="flex items-start gap-3 sm:items-center">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#1F4D2C]/10 text-[#1F4D2C] dark:bg-[#1F4D2C]/30 dark:text-[#8FC9B5]">
                    <Grid3X3 className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      Asignación masiva por carrera, semestre y grupo ({selectedPeriodo})
                    </h3>
                    <p className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
                      Precargado con las 7 carreras oficiales del TESH y semestres 1º al 9º.
                      Selecciona el tutor para cada grupo y guarda en una sola operación.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  disabled={isSavingBulk || selectedGridEntries.length === 0}
                  onClick={handleSaveBulkAssignments}
                  className="h-10 shrink-0 whitespace-nowrap text-xs"
                >
                  <Save className="size-4" />
                  {isSavingBulk
                    ? "Guardando asignaciones..."
                    : `Guardar todas las asignaciones (${selectedGridEntries.length})`}
                </Button>
              </div>

              {/* Tutores disponibles */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 px-4 py-3 text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <span className="font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Tutores disponibles (rol=&apos;tutor&apos;):
                </span>
                {tutores.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1.5 font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
                  >
                    <UserCheck className="size-3.5 text-[#B8860B]" />
                    {t.nombre}
                  </span>
                ))}
              </div>

              {/* Filtros de la grilla */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="grid-filter-career"
                    className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                  >
                    Filtrar por carrera
                  </Label>
                  <select
                    id="grid-filter-career"
                    value={gridCareerFilter}
                    onChange={(e) => setGridCareerFilter(e.target.value)}
                    className={selectControlClassName}
                  >
                    <option value="all">Todas las carreras (7)</option>
                    {TESH_TUTORIAS_CARRERAS.map((career) => (
                      <option key={career} value={career}>
                        {career}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="grid-filter-semester"
                    className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                  >
                    Filtrar por semestre
                  </Label>
                  <select
                    id="grid-filter-semester"
                    value={gridSemesterFilter}
                    onChange={(e) => setGridSemesterFilter(e.target.value)}
                    className={selectControlClassName}
                  >
                    <option value="all">Todos los semestres (1º–9º)</option>
                    {SEMESTRES.map((s) => (
                      <option key={s} value={s}>
                        {s}º Semestre
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="grid-groups-count"
                    className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
                  >
                    Grupos por semestre
                  </Label>
                  <select
                    id="grid-groups-count"
                    value={groupsPerSemester}
                    onChange={(e) => setGroupsPerSemester(Number(e.target.value) as 1 | 2 | 3)}
                    className={selectControlClassName}
                  >
                    <option value={1}>1 grupo por semestre (ej. 101)</option>
                    <option value={2}>2 grupos por semestre (ej. 101, 102)</option>
                    <option value={3}>3 grupos por semestre (ej. 101, 102, 103)</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    <input
                      type="checkbox"
                      checked={gridOnlyUnassigned}
                      onChange={(e) => setGridOnlyUnassigned(e.target.checked)}
                      className="size-4 rounded border-[#E5DFD3] accent-[#1F4D2C]"
                    />
                    Mostrar solo grupos sin tutor
                  </label>
                </div>
              </div>

              {/* Grilla de combinaciones Carrera + Semestre + Grupo -> Dropdown Tutor */}
              <div className="max-h-[540px] overflow-x-auto overflow-y-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[#F5F1E8] dark:bg-[#0F1A12]">
                    <TableRow className="border-[#E5DFD3] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:hover:bg-[#0F1A12]">
                      <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Carrera
                      </TableHead>
                      <TableHead className="w-28 text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Semestre
                      </TableHead>
                      <TableHead className="w-24 text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Grupo
                      </TableHead>
                      <TableHead className="min-w-64 text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Tutor asignado (rol = &apos;tutor&apos;)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGridRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-8 text-center text-xs text-[#6B6B6B] dark:text-[#A8B5A0]"
                        >
                          No hay combinaciones que coincidan con los filtros seleccionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGridRows.map((row) => {
                        const selectedTutorId = gridSelections[row.key] || "";
                        return (
                          <TableRow
                            key={row.key}
                            className={`border-[#E5DFD3] dark:border-[#2D3F2A] ${
                              selectedTutorId
                                ? "bg-[#1F4D2C]/[0.04] dark:bg-[#1F4D2C]/20"
                                : "hover:bg-[#F5F1E8]/40 dark:hover:bg-[#0F1A12]/40"
                            }`}
                          >
                            <TableCell className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                              {row.carrera}
                            </TableCell>
                            <TableCell className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
                              {row.semestre}º Semestre
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs tabular-nums">
                                {row.grupo}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <select
                                aria-label={`Tutor para ${row.carrera} ${row.semestre} semestre grupo ${row.grupo}`}
                                value={selectedTutorId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setGridSelections((prev) => {
                                    const next = { ...prev };
                                    if (!val) {
                                      delete next[row.key];
                                    } else {
                                      next[row.key] = val;
                                    }
                                    return next;
                                  });
                                }}
                                className="h-9 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1A1A1A] focus:border-[#1F4D2C] focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                              >
                                <option value="">— Sin tutor asignado —</option>
                                {tutores.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.nombre} {t.matricula ? `(${t.matricula})` : ""}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col justify-between gap-3 border-t border-[#E5DFD3] pt-3 sm:flex-row sm:items-center dark:border-[#2D3F2A]">
                <p className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
                  Mostrando {filteredGridRows.length} de {allGridRows.length} grupos totales ·{" "}
                  <strong className="text-[#1F4D2C] dark:text-[#8FC9B5]">
                    {selectedGridEntries.length} grupo(s) con tutor seleccionado
                  </strong>
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGridSelections({})}
                    className="h-9 shrink-0 whitespace-nowrap text-xs"
                  >
                    Limpiar selección
                  </Button>
                  <Button
                    type="button"
                    disabled={isSavingBulk || selectedGridEntries.length === 0}
                    onClick={handleSaveBulkAssignments}
                    className="h-9 shrink-0 whitespace-nowrap text-xs"
                  >
                    <CheckCircle2 className="size-4" />
                    {isSavingBulk ? "Guardando..." : "Guardar todas las asignaciones"}
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === "estudiantes" && (
        /* 4. GESTIÓN DE ESTUDIANTES QUE RECURSAN */
        <section className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#B8860B]/15 text-[#B8860B]">
              <ArrowRightLeft className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                Gestión de estudiantes que recursan
              </h3>
              <p className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
                Busca por nombre o matrícula y actualiza carrera, semestre y grupo. Al guardar, el
                estudiante aparece en su grupo nuevo y desaparece del anterior.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6B6B6B] dark:text-[#A8B5A0]" />
              <Input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Buscar estudiante por nombre o matrícula..."
                className="h-10 pl-10 text-xs"
              />
            </div>

            <select
              aria-label="Filtrar estudiantes por carrera"
              value={studentCareerFilter}
              onChange={(e) => setStudentCareerFilter(e.target.value)}
              className={selectControlClassName}
            >
              <option value="all">Todas las carreras</option>
              {TESH_TUTORIAS_CARRERAS.map((career) => (
                <option key={career} value={career}>
                  {career}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5DFD3] bg-[#F5F1E8] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:hover:bg-[#0F1A12]">
                  <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Nombre completo
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Matrícula
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Carrera actual
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Semestre
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Grupo
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Acción
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstudiantes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-xs text-[#6B6B6B] dark:text-[#A8B5A0]"
                    >
                      No se encontraron estudiantes con ese nombre o matrícula.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEstudiantes.map((st) => (
                    <TableRow
                      key={st.id}
                      className="border-[#E5DFD3] hover:bg-[#F5F1E8]/50 dark:border-[#2D3F2A] dark:hover:bg-[#0F1A12]/50"
                    >
                      <TableCell className="text-xs font-semibold text-[#1A1A1A] sm:text-sm dark:text-[#F5F1E8]">
                        {st.nombre}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
                        {st.matricula}
                      </TableCell>
                      <TableCell className="text-xs text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {st.carrera}
                      </TableCell>
                      <TableCell className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
                        {st.semestre}º Semestre
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs tabular-nums">
                          {st.grupo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleOpenEditStudent(st)}
                          className="h-8 shrink-0 whitespace-nowrap text-xs"
                        >
                          <ArrowRightLeft className="size-3.5" />
                          Cambiar grupo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Modal para cambiar carrera, semestre y grupo de un estudiante que recursa */}
      <Dialog
        open={Boolean(editingStudent)}
        onOpenChange={(open) => {
          if (!open && !isUpdatingStudent) setEditingStudent(null);
        }}
      >
        <DialogContent className="rounded-lg border border-[#E5DFD3] bg-white text-[#1A1A1A] sm:max-w-md dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
              Actualizar grupo por recursamiento
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
              {editingStudent
                ? `Reasigna a ${editingStudent.nombre} (${editingStudent.matricula}). Al guardar aparecerá en el grupo nuevo y desaparecerá del anterior.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {editingStudent && (
            <div className="space-y-4 py-2">
              <div className="space-y-1 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-3 text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <p className="font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  {editingStudent.nombre}
                </p>
                <p className="text-[#6B6B6B] dark:text-[#A8B5A0]">
                  Actual: {editingStudent.carrera} · {editingStudent.semestre}º Sem · Grupo{" "}
                  {editingStudent.grupo}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recursamiento-carrera" className="text-xs font-semibold">
                  Nueva carrera
                </Label>
                <select
                  id="recursamiento-carrera"
                  value={editCarrera}
                  onChange={(e) => setEditCarrera(e.target.value)}
                  className={selectControlClassName}
                >
                  {!TESH_TUTORIAS_CARRERAS.includes(
                    editCarrera as (typeof TESH_TUTORIAS_CARRERAS)[number],
                  ) && <option value={editCarrera}>{editCarrera}</option>}
                  {TESH_TUTORIAS_CARRERAS.map((career) => (
                    <option key={career} value={career}>
                      {career}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recursamiento-semestre" className="text-xs font-semibold">
                    Nuevo semestre
                  </Label>
                  <select
                    id="recursamiento-semestre"
                    value={editSemestre}
                    onChange={(e) => {
                      const nextSem = e.target.value;
                      setEditSemestre(nextSem);
                      const suffixMatch = editGrupo.match(/^\d(\d{2})$/);
                      if (suffixMatch) {
                        setEditGrupo(`${nextSem}${suffixMatch[1]}`);
                      }
                    }}
                    className={selectControlClassName}
                  >
                    {SEMESTRES.map((s) => (
                      <option key={s} value={s}>
                        {s}º Semestre
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="recursamiento-grupo" className="text-xs font-semibold">
                    Nuevo grupo
                  </Label>
                  <Input
                    id="recursamiento-grupo"
                    value={editGrupo}
                    onChange={(e) => setEditGrupo(e.target.value)}
                    placeholder={`Ej. ${editSemestre}01`}
                    className="h-10 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isUpdatingStudent}
              onClick={() => setEditingStudent(null)}
              className="h-10 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isUpdatingStudent || !editGrupo.trim()}
              onClick={handleSaveStudentGroupChange}
              className="h-10 text-xs"
            >
              <Save className="size-4" />
              {isUpdatingStudent ? "Guardando..." : "Guardar cambio de grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
