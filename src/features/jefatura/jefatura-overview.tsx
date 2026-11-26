import { useMemo } from "react";
import { ArrowRight, ClipboardList, Grid3X3, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TESH_CAREERS } from "@/lib/directivo-data";
import type {
  CanalizacionRecord,
  TutorGrupoAssignment,
  TutorProfile,
  TutorStudentItem,
} from "@/features/tutor/tutor-service";
import type { JefaturaNavSection } from "./jefatura-sidebar";

interface JefaturaOverviewProps {
  tutors: TutorProfile[];
  assignments: TutorGrupoAssignment[];
  students: TutorStudentItem[];
  canalizaciones: CanalizacionRecord[];
  activePeriodo: string;
  onNavigateSection: (section: JefaturaNavSection) => void;
}

const TOTAL_MATRIZ_GRUPOS = TESH_CAREERS.length * 9 * 3; // 7 carreras × 9 semestres × 3 grupos (A, B, C)

export function JefaturaOverview({
  tutors,
  assignments,
  students,
  canalizaciones,
  activePeriodo,
  onNavigateSection,
}: JefaturaOverviewProps) {
  const activeAssignments = useMemo(
    () =>
      assignments.filter(
        (a) => a.activo !== false && (!activePeriodo || (a.periodo || "2026-2") === activePeriodo),
      ),
    [assignments, activePeriodo],
  );

  const pendingCanalizacionesCount = useMemo(
    () => canalizaciones.filter((c) => c.estado === "pendiente").length,
    [canalizaciones],
  );

  const assignedGroupCount = activeAssignments.length;
  const unassignedGroupCount = Math.max(0, TOTAL_MATRIZ_GRUPOS - assignedGroupCount);

  const estudiantesBajoTutoria = useMemo(() => {
    const activeGroupKeys = new Set(
      activeAssignments.map(
        (a) => `${a.carrera.trim().toLowerCase()}|${String(a.grupo).trim().toLowerCase()}`,
      ),
    );
    return students.filter((st) =>
      activeGroupKeys.has(
        `${st.carrera.trim().toLowerCase()}|${String(st.grupo).trim().toLowerCase()}`,
      ),
    ).length;
  }, [activeAssignments, students]);

  const tutorRows = useMemo(() => {
    return tutors.map((tutor) => {
      const tutorGroups = activeAssignments.filter((a) => a.tutor_id === tutor.id);
      const groupKeys = new Set(
        tutorGroups.map(
          (g) => `${g.carrera.trim().toLowerCase()}|${String(g.grupo).trim().toLowerCase()}`,
        ),
      );
      const assignedStudentsCount = students.filter((st) =>
        groupKeys.has(
          `${st.carrera.trim().toLowerCase()}|${String(st.grupo).trim().toLowerCase()}`,
        ),
      ).length;
      const tutorCanalizacionesCount = canalizaciones.filter((c) => c.tutor_id === tutor.id).length;
      const tutorPendientesCount = canalizaciones.filter(
        (c) => c.tutor_id === tutor.id && c.estado === "pendiente",
      ).length;

      return {
        id: tutor.id,
        nombre: tutor.nombre,
        matricula: tutor.matricula || "TUT-TESH",
        carreraBase: tutor.carrera || "Académico TESH",
        gruposAsignados: tutorGroups.length,
        estudiantesAsignados: assignedStudentsCount,
        canalizacionesTotal: tutorCanalizacionesCount,
        canalizacionesPendientes: tutorPendientesCount,
      };
    });
  }, [tutors, activeAssignments, students, canalizaciones]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
            Resumen operativo de tutorías ({activePeriodo})
          </h2>
          <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
            Control operativo de cobertura docente, carga de estudiantes tutorados y canalizaciones
            activas del campus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onNavigateSection("recursan")}
            className="h-9 shrink-0 whitespace-nowrap rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]"
          >
            Gestionar recursamiento
          </Button>
          <Button
            type="button"
            onClick={() => onNavigateSection("asignaciones")}
            className="h-9 shrink-0 whitespace-nowrap rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
          >
            <Grid3X3 className="mr-1.5 size-4" />
            Asignar tutores
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards Operativos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Total tutores activos
            </span>
            <UserCheck className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          </div>
          <p className="mt-3 text-3xl font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
            {tutors.length}
          </p>
          <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
            Docentes disponibles con rol tutor
          </p>
        </article>

        <article className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Grupos asignados vs sin asignar
            </span>
            <Grid3X3 className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
              {assignedGroupCount}
            </span>
            <span className="text-xs font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
              / {TOTAL_MATRIZ_GRUPOS} matriz
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
            {unassignedGroupCount} grupos sin tutor asignado
          </p>
        </article>

        <article className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Estudiantes bajo tutoría
            </span>
            <Users className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          </div>
          <p className="mt-3 text-3xl font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
            {estudiantesBajoTutoria}
          </p>
          <p className="mt-1 text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
            De {students.length} estudiantes en padrón
          </p>
        </article>

        <article className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
              Canalizaciones pendientes
            </span>
            <ClipboardList className="size-4 text-[#B8860B]" />
          </div>
          <p className="mt-3 text-3xl font-bold text-[#B8860B] tabular-nums">
            {pendingCanalizacionesCount}
          </p>
          <p className="mt-1 text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
            {canalizaciones.length} canalizaciones totales en sistema
          </p>
        </article>
      </div>

      {/* Tabla operativa de tutores con cantidad de estudiantes y canalizaciones */}
      <section className="rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div className="flex flex-col justify-between gap-2 border-b border-[#E5DFD3] px-5 py-4 sm:flex-row sm:items-center dark:border-[#2D3F2A]">
          <div>
            <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              Tutores activos y carga operativa
            </h3>
            <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Grupos cubiertos, matrícula estudiantil asignada y canalizaciones emitidas por tutor.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateSection("canalizaciones")}
            className="h-9 w-fit shrink-0 whitespace-nowrap rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
          >
            Ver todas las canalizaciones
            <ArrowRight className="ml-1.5 size-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
              <tr>
                <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Tutor académico
                </th>
                <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Clave docente
                </th>
                <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Carrera base
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Grupos asignados
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Estudiantes
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Canalizaciones (pendientes)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
              {tutorRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]"
                  >
                    No hay tutores activos registrados en el sistema.
                  </td>
                </tr>
              ) : (
                tutorRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F5F1E8]/60 dark:hover:bg-[#0F1A12]/40">
                    <td className="px-4 py-3 font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      <span className="inline-flex items-center gap-2">
                        <UserCheck className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                        {row.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                      {row.matricula}
                    </td>
                    <td className="px-4 py-3 text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {row.carreraBase}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                      {row.gruposAsignados}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                      {row.estudiantesAsignados}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      <span className="text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {row.canalizacionesTotal}
                      </span>
                      {row.canalizacionesPendientes > 0 && (
                        <span className="ml-1.5 text-[#B8860B]">
                          ({row.canalizacionesPendientes} pend.)
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
