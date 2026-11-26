import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Copy,
  Grid3X3,
  Plus,
  RefreshCw,
  Save,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { TESH_CAREERS } from "@/lib/directivo-data";
import {
  TESH_PERIODOS_SUGERIDOS,
  copyTutorAssignmentsFromPreviousPeriod,
  getAllTutorGroupAssignments,
  getPreviousPeriodo,
  getTutorProfiles,
  saveBulkTutorAssignments,
  updateTutorAssignment,
  type TutorGrupoAssignment,
  type TutorProfile,
} from "@/features/tutor/tutor-service";

interface MatrixCellSlot {
  grupo: "A" | "B" | "C";
  key: string;
}

const SEMESTRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const GRUPOS_MATRIX = ["A", "B", "C"] as const;

function makeCellKey(carrera: string, semestre: string, grupo: string): string {
  return `${carrera.trim().toLowerCase()}|${semestre.trim()}|${grupo.trim().toLowerCase()}`;
}

function mapGrupoToLetterSlot(grupo: string): "A" | "B" | "C" | null {
  const clean = grupo.trim().toUpperCase();
  if (clean === "A" || clean === "B" || clean === "C") return clean;
  if (/^\d?01$/.test(clean) || clean.endsWith("1")) return "A";
  if (/^\d?02$/.test(clean) || clean.endsWith("2")) return "B";
  if (/^\d?03$/.test(clean) || clean.endsWith("3")) return "C";
  return null;
}

interface TutoresAsignacionPanelProps {
  selectedPeriodo?: string;
  onPeriodoChange?: (periodo: string) => void;
  onAssignmentsChanged?: () => void;
}

export function TutoresAsignacionPanel({
  selectedPeriodo: controlledPeriodo,
  onPeriodoChange,
  onAssignmentsChanged,
}: TutoresAsignacionPanelProps) {
  const [tutores, setTutores] = useState<TutorProfile[]>([]);
  const [allAsignaciones, setAllAsignaciones] = useState<TutorGrupoAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [internalPeriodo, setInternalPeriodo] = useState<string>("2026-2");
  const selectedPeriodo = controlledPeriodo ?? internalPeriodo;
  const setSelectedPeriodo = (val: string) => {
    setInternalPeriodo(val);
    onPeriodoChange?.(val);
  };

  const [customPeriodoInput, setCustomPeriodoInput] = useState("");
  const [showCustomPeriodo, setShowCustomPeriodo] = useState(false);
  const [showInactiveRows, setShowInactiveRows] = useState(false);
  const [isCopyingPeriod, setIsCopyingPeriod] = useState(false);

  // Grilla de asignación masiva (7 carreras × 9 semestres × grupos A/B/C)
  const [showBulkGrid, setShowBulkGrid] = useState(true);
  const [gridCareerFilter, setGridCareerFilter] = useState<string>("all");
  const [gridSemesterFilter, setGridSemesterFilter] = useState<string>("all");
  const [gridSelections, setGridSelections] = useState<Record<string, string>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profiles, groupAssignments] = await Promise.all([
        getTutorProfiles(),
        getAllTutorGroupAssignments(),
      ]);
      setTutores(profiles);
      setAllAsignaciones(groupAssignments);
    } catch {
      toast.error("No se pudieron cargar los datos de asignaciones y tutores.");
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

  useEffect(() => {
    const nextSelections: Record<string, string> = {};
    periodAssignments
      .filter((a) => a.activo !== false)
      .forEach((a) => {
        const slotLetter = mapGrupoToLetterSlot(a.grupo);
        if (slotLetter) {
          const k = makeCellKey(a.carrera, a.semestre, slotLetter);
          if (!nextSelections[k] || a.grupo.trim().toUpperCase() === slotLetter) {
            nextSelections[k] = a.tutor_id;
          }
        }
      });
    setGridSelections(nextSelections);
  }, [selectedPeriodo, periodAssignments]);

  const matrixCareers = useMemo(() => {
    if (gridCareerFilter === "all") return [...TESH_CAREERS];
    return TESH_CAREERS.filter((c) => c === gridCareerFilter);
  }, [gridCareerFilter]);

  const matrixSemesters = useMemo(() => {
    if (gridSemesterFilter === "all") return [...SEMESTRES];
    return SEMESTRES.filter((s) => s === gridSemesterFilter);
  }, [gridSemesterFilter]);

  const allMatrixEntries = useMemo(() => {
    const entries: Array<{
      key: string;
      carrera: string;
      semestre: string;
      grupo: "A" | "B" | "C";
      tutor_id: string;
      tutor_nombre: string;
    }> = [];

    for (const carrera of TESH_CAREERS) {
      for (const semestre of SEMESTRES) {
        for (const grupo of GRUPOS_MATRIX) {
          const key = makeCellKey(carrera, semestre, grupo);
          const tutorId = gridSelections[key];
          if (tutorId) {
            const tutor = tutores.find((t) => t.id === tutorId);
            entries.push({
              key,
              carrera,
              semestre,
              grupo,
              tutor_id: tutorId,
              tutor_nombre: tutor?.nombre || "Tutor TESH",
            });
          }
        }
      }
    }
    return entries;
  }, [gridSelections, tutores]);

  const handleOpenCreateFromScratch = () => {
    setShowBulkGrid(true);
    setGridSelections({});
    setGridCareerFilter("all");
    setGridSemesterFilter("all");
    setTimeout(() => {
      document
        .getElementById("asignacion-masiva-matrix")
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
        `Se copiaron ${res.copiedCount} asignaciones de ${res.sourcePeriodo} a ${selectedPeriodo}. El periodo anterior quedó marcado como inactivo.`,
      );
      setShowBulkGrid(true);
      await loadAll();
      onAssignmentsChanged?.();
    } finally {
      setIsCopyingPeriod(false);
    }
  };

  const handleSaveBulkAssignments = async () => {
    if (allMatrixEntries.length === 0) {
      toast.error("Selecciona al menos un tutor en la matriz para guardar.");
      return;
    }

    setIsSavingBulk(true);
    try {
      const res = await saveBulkTutorAssignments({
        periodo: selectedPeriodo,
        assignments: allMatrixEntries.map((item) => ({
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
        `${res.savedCount} asignaciones guardadas en ${selectedPeriodo}. Las asignaciones del periodo anterior (${previousPeriodo}) quedaron inactivas.`,
      );
      await loadAll();
      onAssignmentsChanged?.();
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
    onAssignmentsChanged?.();
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
    onAssignmentsChanged?.();
  };

  const handleAddCustomPeriodo = () => {
    const clean = customPeriodoInput.trim();
    if (!clean) return;
    setSelectedPeriodo(clean);
    setCustomPeriodoInput("");
    setShowCustomPeriodo(false);
  };

  const selectControlClassName =
    "h-10 w-full rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-semibold text-[#1A1A1A] focus:border-[#1F4D2C] focus:ring-2 focus:ring-[#1F4D2C]/20 focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]";

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
            Asignar tutores por periodo académico
          </h2>
          <p className="mt-1 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A8B5A0]">
            Matriz oficial de 7 carreras × 9 semestres × grupos A, B y C. Al crear asignaciones
            nuevas, las del periodo anterior se marcan automáticamente como inactivas.
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

      {/* 1. VISTA DE ASIGNACIONES POR PERIODO */}
      <section className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 space-y-1.5">
              <Label
                htmlFor="jefatura-periodo-select"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                <CalendarRange className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                Periodo académico
              </Label>
              <select
                id="jefatura-periodo-select"
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
                <Button type="button" size="sm" onClick={handleAddCustomPeriodo} className="h-10">
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
              {isCopyingPeriod ? "Copiando..." : `Copiar del periodo anterior (${previousPeriodo})`}
            </Button>

            <Button
              type="button"
              onClick={() => setShowBulkGrid((prev) => !prev)}
              className="h-10 shrink-0 whitespace-nowrap text-xs"
            >
              <Grid3X3 className="size-4" />
              {showBulkGrid ? "Ocultar matriz masiva" : "Abrir matriz masiva"}
            </Button>
          </div>
        </div>

        {/* Resumen del periodo */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DFD3] pt-3 text-xs dark:border-[#2D3F2A]">
          <div className="flex flex-wrap items-center gap-2 text-[#6B6B6B] dark:text-[#A8B5A0]">
            <span className="font-semibold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
              {activePeriodAssignments.length} asignaciones activas en {selectedPeriodo}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {tutores.length} tutores disponibles (rol=&apos;tutor&apos;)
            </span>
            {previousPeriodHasAssignments && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Guardar o copiar marca automáticamente como inactivas las asignaciones de{" "}
                  {previousPeriodo}.
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

        {/* Tabla de asignaciones activas del periodo */}
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
                Inicializa la matriz 7×9×(A, B, C) desde cero o duplica las asignaciones del periodo
                anterior ({previousPeriodo}).
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
                          <Badge variant="muted" className="text-[11px]">
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

      {/* 2. MATRIZ DE ASIGNACIÓN MASIVA (7 carreras × 9 semestres × grupos A/B/C) */}
      {showBulkGrid && (
        <section
          id="asignacion-masiva-matrix"
          className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
        >
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div className="flex items-start gap-3 sm:items-center">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#1F4D2C]/10 text-[#1F4D2C] dark:bg-[#1F4D2C]/30 dark:text-[#8FC9B5]">
                <Grid3X3 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Matriz masiva 7 carreras × 9 semestres × grupos A/B/C ({selectedPeriodo})
                </h3>
                <p className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
                  Cada celda cuenta con un selector de tutores disponibles (rol=&apos;tutor&apos;).
                  Guarda toda la matriz en una sola operación en <code>tutores_grupo</code>.
                </p>
              </div>
            </div>

            <Button
              type="button"
              disabled={isSavingBulk || allMatrixEntries.length === 0}
              onClick={handleSaveBulkAssignments}
              className="h-10 shrink-0 whitespace-nowrap text-xs"
            >
              <Save className="size-4" />
              {isSavingBulk
                ? "Guardando asignaciones..."
                : `Guardar todas las asignaciones (${allMatrixEntries.length})`}
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

          {/* Filtros de matriz */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="jefatura-matrix-career"
                className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Filtrar carrera en matriz
              </Label>
              <select
                id="jefatura-matrix-career"
                value={gridCareerFilter}
                onChange={(e) => setGridCareerFilter(e.target.value)}
                className={selectControlClassName}
              >
                <option value="all">Todas las carreras (7)</option>
                {TESH_CAREERS.map((career) => (
                  <option key={career} value={career}>
                    {career}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="jefatura-matrix-semester"
                className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Filtrar semestre en matriz
              </Label>
              <select
                id="jefatura-matrix-semester"
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
          </div>

          {/* Matriz por Carrera (Filas = Semestre 1º–9º, Columnas = Grupos A / B / C) */}
          <div className="space-y-4">
            {matrixCareers.map((career) => (
              <div
                key={career}
                className="overflow-hidden rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]"
              >
                <div className="flex items-center justify-between border-b border-[#E5DFD3] bg-[#F5F1E8] px-4 py-2.5 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <h4 className="text-xs font-bold text-[#1F4D2C] sm:text-sm dark:text-[#8FC9B5]">
                    {career}
                  </h4>
                  <span className="text-[11px] font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                    {allMatrixEntries.filter((entry) => entry.carrera === career).length} de 27
                    grupos asignados
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#E5DFD3] bg-white hover:bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:hover:bg-[#1A2618]">
                        <TableHead className="w-28 text-xs font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Semestre
                        </TableHead>
                        {GRUPOS_MATRIX.map((grupo) => (
                          <TableHead
                            key={grupo}
                            className="min-w-52 text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]"
                          >
                            Grupo {grupo}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matrixSemesters.map((sem) => {
                        const cells: MatrixCellSlot[] = GRUPOS_MATRIX.map((grupo) => ({
                          grupo,
                          key: makeCellKey(career, sem, grupo),
                        }));
                        return (
                          <TableRow
                            key={`${career}-${sem}`}
                            className="border-[#E5DFD3] hover:bg-[#F5F1E8]/40 dark:border-[#2D3F2A] dark:hover:bg-[#0F1A12]/40"
                          >
                            <TableCell className="text-xs font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
                              {sem}º Semestre
                            </TableCell>
                            {cells.map((cell) => {
                              const selectedTutorId = gridSelections[cell.key] || "";
                              return (
                                <TableCell key={cell.key}>
                                  <select
                                    aria-label={`Tutor para ${career} ${sem} semestre grupo ${cell.grupo}`}
                                    value={selectedTutorId}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setGridSelections((prev) => {
                                        const next = { ...prev };
                                        if (!val) {
                                          delete next[cell.key];
                                        } else {
                                          next[cell.key] = val;
                                        }
                                        return next;
                                      });
                                    }}
                                    className={`h-9 w-full rounded-lg border px-2.5 text-xs font-semibold focus:border-[#1F4D2C] focus:outline-none ${
                                      selectedTutorId
                                        ? "border-[#1F4D2C]/50 bg-[#1F4D2C]/[0.05] text-[#1F4D2C] dark:border-[#8FC9B5]/40 dark:bg-[#1F4D2C]/25 dark:text-[#F5F1E8]"
                                        : "border-[#E5DFD3] bg-white text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                                    }`}
                                  >
                                    <option value="">— Sin tutor —</option>
                                    {tutores.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-[#E5DFD3] pt-3 sm:flex-row sm:items-center dark:border-[#2D3F2A]">
            <p className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A8B5A0]">
              Matriz total: 189 grupos (7 carreras × 9 semestres × A/B/C) ·{" "}
              <strong className="text-[#1F4D2C] dark:text-[#8FC9B5]">
                {allMatrixEntries.length} grupo(s) con tutor seleccionado
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
                disabled={isSavingBulk || allMatrixEntries.length === 0}
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
  );
}
