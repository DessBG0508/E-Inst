import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CalendarDays,
  Check,
  Copy,
  Loader2,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TESH_CAREERS } from "@/lib/directivo-data";
import {
  assignTutorToGroup,
  copyTutorAssignmentsFromPreviousPeriod,
  getAllStudentsForDirectivo,
  getPreviousPeriodo,
  getTutorGroupAssignmentsByPeriod,
  getTutorProfiles,
  TESH_PERIODOS_SUGERIDOS,
  updateStudentAcademicGroup,
  type TutorGrupoAssignment,
  type TutorProfile,
  type TutorStudentItem,
} from "@/features/tutor/tutor-service";

const SEMESTRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const GROUP_SLOTS = ["A", "B", "C"] as const;
type GroupSlot = (typeof GROUP_SLOTS)[number];

function normalizeStr(val?: string | null): string {
  return (val || "").trim().toLowerCase();
}

function normalizeSem(val?: string | number | null): string {
  const digits = String(val ?? "").match(/\d+/);
  return digits ? digits[0] : String(val ?? "").trim();
}

function mapGrupoToSlot(grupo: string, semestre: string): GroupSlot | null {
  const g = grupo.trim().toUpperCase();
  const s = normalizeSem(semestre);
  if (g === "A" || g === `${s}01` || g.endsWith("A")) return "A";
  if (g === "B" || g === `${s}02` || g.endsWith("B")) return "B";
  if (g === "C" || g === `${s}03` || g.endsWith("C")) return "C";
  return null;
}

function buildCellKey(carrera: string, semestre: string, slot: GroupSlot): string {
  return `${normalizeStr(carrera)}|${normalizeSem(semestre)}|${slot}`;
}

export function DirectivoAsignacionesMatrix() {
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("2026-2");
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [assignments, setAssignments] = useState<TutorGrupoAssignment[]>([]);
  const [students, setStudents] = useState<TutorStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  // Modal de asignación de tutor por celda
  const [assignTarget, setAssignTarget] = useState<{
    carrera: string;
    semestre: string;
    slot: GroupSlot;
    currentAssignment?: TutorGrupoAssignment;
  } | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<string>("");
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Modal de estudiantes que recursan
  const [recursanOpen, setRecursanOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentCareerFilter, setStudentCareerFilter] = useState<string>("all");
  const [editingStudent, setEditingStudent] = useState<TutorStudentItem | null>(null);
  const [editCarrera, setEditCarrera] = useState<string>(TESH_CAREERS[0]);
  const [editSemestre, setEditSemestre] = useState<string>("1");
  const [editGrupo, setEditGrupo] = useState<string>("A");
  const [savingStudentMove, setSavingStudentMove] = useState(false);

  const loadData = useCallback(async (periodo: string) => {
    setLoading(true);
    try {
      const [tutorList, periodAssignments, allStudents] = await Promise.all([
        getTutorProfiles(),
        getTutorGroupAssignmentsByPeriod(periodo),
        getAllStudentsForDirectivo(),
      ]);
      setTutors(tutorList);
      setAssignments(periodAssignments);
      setStudents(allStudents);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedPeriodo);
  }, [loadData, selectedPeriodo]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, TutorGrupoAssignment>();
    for (const item of assignments) {
      if (item.activo === false) continue;
      const slot = mapGrupoToSlot(item.grupo, item.semestre);
      if (!slot) continue;
      const key = buildCellKey(item.carrera, item.semestre, slot);
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return map;
  }, [assignments]);

  const studentCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const st of students) {
      const slot = mapGrupoToSlot(st.grupo, st.semestre);
      if (!slot) continue;
      const key = buildCellKey(st.carrera, st.semestre, slot);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [students]);

  const filteredStudentsForModal = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((st) => {
      if (studentCareerFilter !== "all" && st.carrera !== studentCareerFilter) {
        return false;
      }
      if (!q) return true;
      return (
        st.nombre.toLowerCase().includes(q) ||
        st.matricula.toLowerCase().includes(q) ||
        st.carrera.toLowerCase().includes(q)
      );
    });
  }, [students, studentSearch, studentCareerFilter]);

  const handleOpenAssignModal = (
    carrera: string,
    semestre: string,
    slot: GroupSlot,
    currentAssignment?: TutorGrupoAssignment,
  ) => {
    setAssignTarget({ carrera, semestre, slot, currentAssignment });
    setSelectedTutorId(currentAssignment?.tutor_id || tutors[0]?.id || "");
  };

  const handleSaveAssignment = async () => {
    if (!assignTarget || !selectedTutorId) {
      toast.error("Selecciona un tutor para asignar al grupo.");
      return;
    }
    const tutorObj = tutors.find((t) => t.id === selectedTutorId);
    setSavingAssignment(true);
    try {
      const targetGrupo = assignTarget.currentAssignment?.grupo || assignTarget.slot;
      const res = await assignTutorToGroup({
        tutor_id: selectedTutorId,
        tutor_nombre: tutorObj?.nombre,
        carrera: assignTarget.carrera,
        semestre: assignTarget.semestre,
        grupo: targetGrupo,
        periodo: selectedPeriodo,
      });
      if (!res.ok) {
        toast.error(res.error || "No se pudo guardar la asignación.");
        return;
      }
      toast.success(
        `Tutor asignado a ${assignTarget.carrera} · ${assignTarget.semestre}º Grupo ${assignTarget.slot}.`,
      );
      setAssignTarget(null);
      await loadData(selectedPeriodo);
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleCopyPreviousPeriod = async () => {
    const previous = getPreviousPeriodo(selectedPeriodo);
    setCopying(true);
    try {
      const res = await copyTutorAssignmentsFromPreviousPeriod({
        targetPeriodo: selectedPeriodo,
        sourcePeriodo: previous,
      });
      if (!res.ok) {
        toast.error(res.error || `No fue posible copiar desde ${previous}.`);
        return;
      }
      toast.success(
        `Se copiaron ${res.copiedCount} asignaciones de tutorías desde el periodo ${res.sourcePeriodo}.`,
      );
      await loadData(selectedPeriodo);
    } finally {
      setCopying(false);
    }
  };

  const handleOpenStudentMove = (st: TutorStudentItem) => {
    setEditingStudent(st);
    setEditCarrera(st.carrera);
    setEditSemestre(normalizeSem(st.semestre) || "1");
    setEditGrupo(st.grupo || "A");
  };

  const handleSaveStudentMove = async () => {
    if (!editingStudent) return;
    setSavingStudentMove(true);
    try {
      const res = await updateStudentAcademicGroup({
        studentId: editingStudent.id,
        carrera: editCarrera,
        semestre: editSemestre,
        grupo: editGrupo,
      });
      if (!res.ok) {
        toast.error(res.error || "No se pudo reasignar el grupo del estudiante.");
        return;
      }
      toast.success(
        `${editingStudent.nombre} actualizado a ${editCarrera} · ${editSemestre}º Grupo ${editGrupo}.`,
      );
      setEditingStudent(null);
      await loadData(selectedPeriodo);
    } finally {
      setSavingStudentMove(false);
    }
  };

  const totalAssignedCells = useMemo(
    () => assignments.filter((a) => a.activo !== false).length,
    [assignments],
  );

  return (
    <div className="space-y-6">
      {/* Encabezado y Acciones Principales */}
      <div className="flex flex-col gap-4 border-b border-[#E5DFD3] pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
            Asignación de tutores por carrera y semestre
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            Matriz institucional de 7 carreras × 9 semestres (grupos A, B y C) ·{" "}
            <span className="font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
              {totalAssignedCells}
            </span>{" "}
            grupos asignados en {selectedPeriodo}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de periodo */}
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
            <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
              <SelectTrigger
                aria-label="Seleccionar periodo escolar"
                className="h-9 w-36 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
              >
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                {TESH_PERIODOS_SUGERIDOS.map((per) => (
                  <SelectItem key={per} value={per} className="text-xs font-medium">
                    Periodo {per}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setRecursanOpen(true)}
            className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
          >
            <ArrowRightLeft className="mr-1.5 size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
            Estudiantes que recursan
          </Button>

          <Button
            type="button"
            disabled={copying}
            onClick={handleCopyPreviousPeriod}
            className="h-9 rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
          >
            {copying ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Copy className="mr-1.5 size-3.5" />
            )}
            Copiar asignaciones del periodo anterior
          </Button>
        </div>
      </div>

      {/* Matriz 7 Carreras × 9 Semestres (Grupos A / B / C) */}
      <div className="rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DFD3] px-4 py-3 text-xs dark:border-[#2D3F2A]">
          <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
            Matriz de cobertura tutorial ({selectedPeriodo})
          </span>
          <span className="font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
            Haz clic en cualquier celda de grupo (A, B o C) para asignar o actualizar al tutor.
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#6B6B6B]">
            <Loader2 className="size-4 animate-spin text-[#1F4D2C]" />
            <span>Cargando matriz institucional de tutorías...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <th className="sticky left-0 z-10 w-56 border-r border-[#E5DFD3] bg-[#F5F1E8] px-3 py-3 font-bold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    Carrera TESH
                  </th>
                  {SEMESTRES.map((sem) => (
                    <th
                      key={sem}
                      className="min-w-[120px] border-r border-[#E5DFD3] px-2 py-3 text-center font-bold text-[#1F4D2C] last:border-r-0 dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
                    >
                      {sem}º Sem.
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                {TESH_CAREERS.map((career) => (
                  <tr key={career} className="align-top">
                    <th className="sticky left-0 z-10 border-r border-[#E5DFD3] bg-white px-3 py-3 text-left font-semibold text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
                      {career}
                    </th>
                    {SEMESTRES.map((sem) => (
                      <td
                        key={`${career}-${sem}`}
                        className="border-r border-[#E5DFD3] p-1.5 last:border-r-0 dark:border-[#2D3F2A]"
                      >
                        <div className="space-y-1">
                          {GROUP_SLOTS.map((slot) => {
                            const key = buildCellKey(career, sem, slot);
                            const assigned = assignmentMap.get(key);
                            const studentCount = studentCountMap.get(key) || 0;

                            if (assigned) {
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => handleOpenAssignModal(career, sem, slot, assigned)}
                                  title={`Cambiar tutor de ${career} · ${sem}º Grupo ${slot}`}
                                  className="w-full cursor-pointer rounded border border-[#E5DFD3] bg-[#F5F1E8]/70 px-2 py-1.5 text-left transition-colors hover:border-[#1F4D2C] hover:bg-[#E0F0E8]/50 dark:border-[#2D3F2A] dark:bg-[#0F1A12]/70 dark:hover:border-[#8FC9B5]"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                      {slot}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                      <Users className="size-2.5" />
                                      {studentCount}
                                    </span>
                                  </div>
                                  <p className="truncate text-[11px] font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                                    {assigned.tutor_nombre || "Tutor asignado"}
                                  </p>
                                </button>
                              );
                            }

                            return (
                              <Button
                                key={slot}
                                type="button"
                                variant="ghost"
                                onClick={() => handleOpenAssignModal(career, sem, slot)}
                                className="h-auto w-full justify-between rounded px-2 py-1 text-[11px] font-medium text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12] dark:hover:text-[#8FC9B5]"
                              >
                                <span className="font-semibold">{slot}</span>
                                <span className="inline-flex items-center gap-1">
                                  <UserPlus className="size-3" />
                                  Asignar tutor
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Asignar / Reasignar Tutor a Celda */}
      <Dialog open={Boolean(assignTarget)} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent className="rounded-lg border-[#E5DFD3] bg-white sm:max-w-md dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
              {assignTarget?.currentAssignment ? "Actualizar tutor asignado" : "Asignar tutor"}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              {assignTarget
                ? `${assignTarget.carrera} · ${assignTarget.semestre}º Semestre · Grupo ${assignTarget.slot} (${selectedPeriodo})`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="tutor-select-matrix"
                className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Tutor académico
              </Label>
              <Select value={selectedTutorId} onValueChange={setSelectedTutorId}>
                <SelectTrigger
                  id="tutor-select-matrix"
                  className="h-10 rounded-lg border-[#E5DFD3] bg-white text-sm dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                >
                  <SelectValue placeholder="Selecciona un tutor" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.nombre} {t.matricula ? `(${t.matricula})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignTarget(null)}
              className="rounded-lg border-[#E5DFD3] text-xs font-semibold dark:border-[#2D3F2A]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingAssignment || !selectedTutorId}
              onClick={handleSaveAssignment}
              className="rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
            >
              {savingAssignment ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 size-3.5" />
              )}
              Guardar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Estudiantes que Recursan (Cambio de Carrera / Semestre / Grupo Académico) */}
      <Dialog open={recursanOpen} onOpenChange={setRecursanOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-lg border-[#E5DFD3] bg-white sm:max-w-3xl dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
              Estudiantes que recursan · Reubicación académica
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Actualiza únicamente la adscripción académica (carrera, semestre y grupo) sin exponer
              información clínica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6B6B6B]" />
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Buscar por nombre o matrícula..."
                  className="h-9 rounded-lg border-[#E5DFD3] pl-9 text-xs focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                />
              </div>
              <Select value={studentCareerFilter} onValueChange={setStudentCareerFilter}>
                <SelectTrigger className="h-9 w-full rounded-lg border-[#E5DFD3] text-xs sm:w-64 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <SelectValue placeholder="Todas las carreras" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                  <SelectItem value="all" className="text-xs font-semibold">
                    Todas las carreras
                  </SelectItem>
                  {TESH_CAREERS.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingStudent && (
              <div className="rounded-lg border border-[#1F4D2C]/30 bg-[#F5F1E8] p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Reasignando grupo académico: {editingStudent.nombre}
                    </p>
                    <p className="text-[11px] font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                      Matrícula {editingStudent.matricula}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingStudent(null)}
                    className="h-7 text-xs text-[#6B6B6B]"
                  >
                    Cerrar
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Carrera</Label>
                    <Select value={editCarrera} onValueChange={setEditCarrera}>
                      <SelectTrigger className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        {TESH_CAREERS.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Semestre</Label>
                    <Select value={editSemestre} onValueChange={setEditSemestre}>
                      <SelectTrigger className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        {SEMESTRES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}º Semestre
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Grupo</Label>
                    <Select value={editGrupo} onValueChange={setEditGrupo}>
                      <SelectTrigger className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <SelectItem value="A" className="text-xs">
                          Grupo A
                        </SelectItem>
                        <SelectItem value="B" className="text-xs">
                          Grupo B
                        </SelectItem>
                        <SelectItem value="C" className="text-xs">
                          Grupo C
                        </SelectItem>
                        <SelectItem value={`${editSemestre}01`} className="text-xs">
                          {editSemestre}01 (Equiv. A)
                        </SelectItem>
                        <SelectItem value={`${editSemestre}02`} className="text-xs">
                          {editSemestre}02 (Equiv. B)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    disabled={savingStudentMove}
                    onClick={handleSaveStudentMove}
                    className="h-8 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                  >
                    {savingStudentMove ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 size-3.5" />
                    )}
                    Guardar cambio de grupo
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Estudiante
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Matrícula
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Adscripción actual
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                  {filteredStudentsForModal.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[#6B6B6B]">
                        No se encontraron estudiantes con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filteredStudentsForModal.map((st) => (
                      <tr key={st.id} className="hover:bg-[#F5F1E8]/60 dark:hover:bg-[#0F1A12]/40">
                        <td className="px-3 py-2.5 font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {st.nombre}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                          {st.matricula}
                        </td>
                        <td className="px-3 py-2.5 text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {st.carrera} · {normalizeSem(st.semestre)}º Grupo {st.grupo}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStudentMove(st)}
                            className="h-7 px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#E0F0E8]/60 dark:text-[#8FC9B5]"
                          >
                            Cambiar grupo
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
