import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, RefreshCw, Save, Search } from "lucide-react";
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
import { TESH_CAREERS } from "@/lib/directivo-data";
import {
  getAllStudentsForJefatura,
  updateStudentAcademicGroup,
  type TutorStudentItem,
} from "@/features/tutor/tutor-service";

const SEMESTRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const GRUPOS_SUGERIDOS = ["A", "B", "C"] as const;

interface EstudiantesRecursanPanelProps {
  onStudentUpdated?: () => void;
}

export function EstudiantesRecursanPanel({ onStudentUpdated }: EstudiantesRecursanPanelProps) {
  const [estudiantes, setEstudiantes] = useState<TutorStudentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [studentSearch, setStudentSearch] = useState("");
  const [studentCareerFilter, setStudentCareerFilter] = useState<string>("all");
  const [editingStudent, setEditingStudent] = useState<TutorStudentItem | null>(null);
  const [editCarrera, setEditCarrera] = useState<string>(TESH_CAREERS[0]);
  const [editSemestre, setEditSemestre] = useState<string>("1");
  const [editGrupo, setEditGrupo] = useState<string>("A");
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getAllStudentsForJefatura();
      setEstudiantes(list);
    } catch {
      toast.error("No se pudo cargar el padrón de estudiantes.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const careerOptions = useMemo(() => {
    const set = new Set<string>([...TESH_CAREERS]);
    estudiantes.forEach((s) => {
      if (s.carrera?.trim()) set.add(s.carrera.trim());
    });
    return Array.from(set);
  }, [estudiantes]);

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
    setEditCarrera(st.carrera || TESH_CAREERS[0]);
    setEditSemestre(String(st.semestre || "1").replace(/\D/g, "") || "1");
    setEditGrupo(st.grupo || "A");
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
      await loadStudents();
      onStudentUpdated?.();
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  const selectControlClassName =
    "h-10 w-full rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-semibold text-[#1A1A1A] focus:border-[#1F4D2C] focus:ring-2 focus:ring-[#1F4D2C]/20 focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
            Estudiantes que recursan y cambio de grupo
          </h2>
          <p className="mt-1 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A8B5A0]">
            Busca estudiantes por nombre o matrícula y reubícalos de carrera, semestre o grupo. Al
            guardar, aparecen en el grupo nuevo y dejan el anterior.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadStudents}
          className="h-10 w-fit shrink-0 whitespace-nowrap"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar padrón
        </Button>
      </div>

      <section className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#B8860B]/15 text-[#B8860B]">
            <ArrowRightLeft className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              Búsqueda y reasignación de grupo ({filteredEstudiantes.length} estudiantes)
            </h3>
            <p className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
              Actualiza directamente la adscripción académica en <code>profiles</code> sin exponer
              información clínica.
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
            {careerOptions.map((career) => (
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
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-xs text-[#6B6B6B] dark:text-[#A8B5A0]"
                  >
                    Cargando padrón estudiantil...
                  </TableCell>
                </TableRow>
              ) : filteredEstudiantes.length === 0 ? (
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

      {/* Modal para cambiar carrera, semestre y grupo */}
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
                <Label htmlFor="jefatura-recursamiento-carrera" className="text-xs font-semibold">
                  Nueva carrera
                </Label>
                <select
                  id="jefatura-recursamiento-carrera"
                  value={editCarrera}
                  onChange={(e) => setEditCarrera(e.target.value)}
                  className={selectControlClassName}
                >
                  {!careerOptions.includes(editCarrera) && (
                    <option value={editCarrera}>{editCarrera}</option>
                  )}
                  {careerOptions.map((career) => (
                    <option key={career} value={career}>
                      {career}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="jefatura-recursamiento-semestre"
                    className="text-xs font-semibold"
                  >
                    Nuevo semestre
                  </Label>
                  <select
                    id="jefatura-recursamiento-semestre"
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
                  <Label htmlFor="jefatura-recursamiento-grupo" className="text-xs font-semibold">
                    Nuevo grupo
                  </Label>
                  <Input
                    id="jefatura-recursamiento-grupo"
                    list="jefatura-grupos-sugeridos"
                    value={editGrupo}
                    onChange={(e) => setEditGrupo(e.target.value)}
                    placeholder="Ej. A, B, C o 501"
                    className="h-10 text-xs font-semibold"
                  />
                  <datalist id="jefatura-grupos-sugeridos">
                    {GRUPOS_SUGERIDOS.map((g) => (
                      <option key={g} value={g} />
                    ))}
                    <option value={`${editSemestre}01`} />
                    <option value={`${editSemestre}02`} />
                  </datalist>
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
