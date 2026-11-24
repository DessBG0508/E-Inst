import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  FileSpreadsheet,
  GraduationCap,
  Grid3X3,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { DIRECTIVO_MOCK_RECORDS, TESH_CAREERS, getDirectivoKPIs } from "@/lib/directivo-data";
import {
  getAllStudentsForDirectivo,
  getAllTutorGroupAssignments,
  getCanalizaciones,
  getTutorProfiles,
  type CanalizacionRecord,
  type TutorGrupoAssignment,
  type TutorProfile,
  type TutorStudentItem,
} from "@/features/tutor/tutor-service";
import { getSolicitudesPsicologo } from "@/features/agenda/agenda-service";
import {
  calcularMetricasEncuesta,
  getRespuestasEncuesta,
} from "@/features/encuesta/encuesta-service";
import { DirectivoSidebar, type DirectivoNavSection } from "./directivo-sidebar";
import { DirectivoResumenEjecutivo } from "./directivo-resumen-ejecutivo";
import { DirectivoAsignacionesMatrix } from "./directivo-asignaciones-matrix";
import { DirectivoCanalizacionesView } from "./directivo-canalizaciones-view";

const SECTION_LABELS: Record<DirectivoNavSection, string> = {
  resumen: "Resumen ejecutivo",
  estudiantes: "Estudiantes",
  tutores: "Tutores",
  canalizaciones: "Canalizaciones",
  asignaciones: "Asignaciones",
  reportes: "Reportes",
};

export function DirectivoDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DirectivoNavSection>("resumen");

  const [students, setStudents] = useState<TutorStudentItem[]>([]);
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [assignments, setAssignments] = useState<TutorGrupoAssignment[]>([]);
  const [canalizaciones, setCanalizaciones] = useState<CanalizacionRecord[]>([]);

  useEffect(() => {
    let active = true;
    async function loadDirectoryCounts() {
      try {
        const [st, tut, asg, can] = await Promise.all([
          getAllStudentsForDirectivo(),
          getTutorProfiles(),
          getAllTutorGroupAssignments(),
          getCanalizaciones(),
        ]);
        if (!active) return;
        setStudents(st);
        setTutors(tut);
        setAssignments(asg);
        setCanalizaciones(can);
      } catch {
        // Fallback silencioso
      }
    }
    loadDirectoryCounts();
    return () => {
      active = false;
    };
  }, [activeSection]);

  const pendingCanalizacionesCount = useMemo(
    () => canalizaciones.filter((c) => c.estado === "pendiente").length,
    [canalizaciones],
  );

  // Matriz agregada y anónima de estudiantes por carrera y semestre (sin nombres ni datos clínicos)
  const estudiantesPorCarrera = useMemo(() => {
    return TESH_CAREERS.map((career) => {
      const enrolled = students.filter((s) => s.carrera === career);
      const tamizados = DIRECTIVO_MOCK_RECORDS.filter((r) => r.career === career).length;
      const semestresSet = new Set(enrolled.map((e) => e.semestre).filter(Boolean));
      const gruposSet = new Set(enrolled.map((e) => e.grupo).filter(Boolean));

      return {
        career,
        matriculaRegistrada: enrolled.length,
        semestresActivos: semestresSet.size,
        gruposActivos: gruposSet.size,
        tamizajesAnonimos: tamizados,
      };
    });
  }, [students]);

  // Directorio operativo de tutores (carga tutorial y canalizaciones administrativas)
  const tutoresResumen = useMemo(() => {
    return tutors.map((tutor) => {
      const activeGroups = assignments.filter((a) => a.tutor_id === tutor.id && a.activo !== false);
      const tutorCanCount = canalizaciones.filter((c) => c.tutor_id === tutor.id).length;
      return {
        id: tutor.id,
        nombre: tutor.nombre,
        matricula: tutor.matricula || "TUT-TESH",
        carreraBase: tutor.carrera || "Académico TESH",
        gruposAsignados: activeGroups.length,
        canalizacionesEmitidas: tutorCanCount,
      };
    });
  }, [tutors, assignments, canalizaciones]);

  const handleLogout = () => {
    logout();
    toast.info("Has cerrado sesión.");
    navigate({ to: "/login", replace: true });
  };

  const handleExportResumenGeneralExcel = async () => {
    const kpis = getDirectivoKPIs("all");
    const [citas, respuestas] = await Promise.all([
      getSolicitudesPsicologo(),
      getRespuestasEncuesta(),
    ]);
    const completadas = citas.filter((c) => c.estado === "completada").length;
    const noAsistio = citas.filter((c) => c.estado === "no_asistio").length;
    const pb021 = calcularMetricasEncuesta(respuestas);

    const resumenRows = [
      {
        Indicador: "Total estudiantes tamizados (muestra agregada)",
        Valor: kpis.totalSamples,
      },
      { Indicador: "Semáforo Verde (%)", Valor: `${kpis.pctVerde}%` },
      { Indicador: "Semáforo Amarillo (%)", Valor: `${kpis.pctAmarillo}%` },
      { Indicador: "Semáforo Rojo (%)", Valor: `${kpis.pctRojo}%` },
      { Indicador: "Citas completadas", Valor: completadas },
      { Indicador: "Citas no_asistio", Valor: noAsistio },
      { Indicador: "Promedio satisfacción PB-021", Valor: pb021.promedioGeneral.toFixed(1) },
      { Indicador: "Encuestas PB-021 respondidas", Valor: pb021.totalRespondidas },
    ];

    const careerRows = TESH_CAREERS.map((career) => {
      const cKpis = getDirectivoKPIs(career);
      return {
        Carrera: career,
        "Muestras anónimas": cKpis.totalSamples,
        "Verde (%)": cKpis.pctVerde,
        "Amarillo (%)": cKpis.pctAmarillo,
        "Rojo (%)": cKpis.pctRojo,
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), "KPIs Campus");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(careerRows), "Por Carrera");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Equilibra_TESH_Resumen_Ejecutivo_${stamp}.xlsx`);
    toast.success("Reporte ejecutivo anónimo descargado en Excel.");
  };

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Dirección Académica",
      onClick: () => setActiveSection("resumen"),
    },
    {
      label: SECTION_LABELS[activeSection],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <InstitutionalHeader
        moduleTitle={`Panel directivo — ${SECTION_LABELS[activeSection]}`}
        breadcrumbs={breadcrumbs}
        onHomeClick={() => setActiveSection("resumen")}
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

      <div className="flex min-w-0 flex-1">
        <DirectivoSidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          pendingCanalizacionesCount={pendingCanalizacionesCount}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1 lg:pl-64">
          <main className="mx-auto w-full max-w-7xl p-4 pb-16 sm:p-6 lg:p-8">
            {activeSection === "resumen" && <DirectivoResumenEjecutivo />}

            {activeSection === "estudiantes" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                      Matrícula estudiantil agregada por programa
                    </h2>
                    <p className="mt-0.5 text-xs sm:text-sm font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Distribución académica anónima sin exposición de expedientes clínicos ni
                      puntajes individuales.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setActiveSection("asignaciones")}
                    className="h-9 rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
                  >
                    <Grid3X3 className="mr-1.5 size-4" />
                    Gestionar recursamiento y grupos
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <article className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Estudiantes en padrón académico
                      </span>
                      <Users className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    </div>
                    <p className="mt-3 text-3xl font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                      {students.length}
                    </p>
                  </article>

                  <article className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Programas educativos TESH
                      </span>
                      <GraduationCap className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    </div>
                    <p className="mt-3 text-3xl font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                      {TESH_CAREERS.length}
                    </p>
                  </article>

                  <article className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Privacidad LFPDPPP
                      </span>
                      <ShieldCheck className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    </div>
                    <p className="mt-3 text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      100% Agregado
                    </p>
                  </article>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Carrera TESH
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Matrícula registrada
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Semestres activos
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Grupos activos
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Muestras tamizaje anónimas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                      {estudiantesPorCarrera.map((row) => (
                        <tr
                          key={row.career}
                          className="hover:bg-[#F5F1E8]/60 dark:hover:bg-[#0F1A12]/40"
                        >
                          <td className="px-4 py-3 font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {row.career}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                            {row.matriculaRegistrada}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                            {row.semestresActivos}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                            {row.gruposActivos}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                            {row.tamizajesAnonimos}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === "tutores" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                      Directorio institucional de tutores
                    </h2>
                    <p className="mt-0.5 text-xs sm:text-sm font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Cobertura docente de tutorías académicas y volumen administrativo de
                      canalizaciones.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setActiveSection("asignaciones")}
                    className="h-9 rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
                  >
                    Ir a matriz de asignaciones
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
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
                          Adscripción principal
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Grupos asignados
                        </th>
                        <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          Canalizaciones emitidas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                      {tutoresResumen.map((t) => (
                        <tr key={t.id} className="hover:bg-[#F5F1E8]/60 dark:hover:bg-[#0F1A12]/40">
                          <td className="px-4 py-3 font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            <span className="inline-flex items-center gap-2">
                              <UserCheck className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                              {t.nombre}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                            {t.matricula}
                          </td>
                          <td className="px-4 py-3 text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {t.carreraBase}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                            {t.gruposAsignados}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                            {t.canalizacionesEmitidas}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === "canalizaciones" && <DirectivoCanalizacionesView />}

            {activeSection === "asignaciones" && <DirectivoAsignacionesMatrix />}

            {activeSection === "reportes" && (
              <div className="space-y-6">
                <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Reportes institucionales y auditoría
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Descarga de tabulados ejecutivos anónimos en Excel (.xlsx) y verificación de
                    integridad en auditoría.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Reporte ejecutivo agregado (.xlsx)
                        </h3>
                        <FileSpreadsheet className="size-5 text-[#B8860B]" />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Exporta distribución del semáforo por las 7 carreras TESH, tasa de citas
                        completadas vs no asistió y promedio de encuestas PB-021 sin datos
                        personales.
                      </p>
                    </div>
                    <div className="mt-5">
                      <Button
                        type="button"
                        onClick={handleExportResumenGeneralExcel}
                        className="h-9 rounded-lg bg-[#B8860B] px-4 text-xs font-semibold text-white hover:bg-[#D4A82B]"
                      >
                        <FileSpreadsheet className="mr-1.5 size-4" />
                        Descargar resumen en Excel
                      </Button>
                    </div>
                  </article>

                  <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Auditoría institucional y trazabilidad
                        </h3>
                        <ShieldCheck className="size-5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Consulta el historial de integridad y bitácora verificable de operaciones
                        del sistema Equilibra TESH v2.0.
                      </p>
                    </div>
                    <div className="mt-5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate({ to: "/auditoria" })}
                        className="h-9 rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
                      >
                        Abrir módulo de auditoría
                        <ArrowRight className="ml-1.5 size-3.5" />
                      </Button>
                    </div>
                  </article>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
