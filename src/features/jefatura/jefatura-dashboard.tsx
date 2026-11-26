import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet, Grid3X3, Settings, Users } from "lucide-react";
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
import { TESH_CAREERS } from "@/lib/directivo-data";
import {
  getAllStudentsForJefatura,
  getAllTutorGroupAssignments,
  getCanalizaciones,
  getTutorProfiles,
  type CanalizacionRecord,
  type TutorGrupoAssignment,
  type TutorProfile,
  type TutorStudentItem,
} from "@/features/tutor/tutor-service";
import { JefaturaSidebar, type JefaturaNavSection } from "./jefatura-sidebar";
import { JefaturaOverview } from "./jefatura-overview";
import { TutoresAsignacionPanel } from "./tutores-asignacion-panel";
import { EstudiantesRecursanPanel } from "./estudiantes-recursan-panel";
import { JefaturaCanalizacionesView } from "./jefatura-canalizaciones-view";

const SECTION_LABELS: Record<JefaturaNavSection, string> = {
  dashboard: "Dashboard",
  asignaciones: "Asignar tutores",
  recursan: "Estudiantes que recursan",
  canalizaciones: "Canalizaciones",
  reportes: "Reportes",
};

export function JefaturaDashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<JefaturaNavSection>("dashboard");
  const [activePeriodo, setActivePeriodo] = useState<string>("2026-2");

  const [students, setStudents] = useState<TutorStudentItem[]>([]);
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [assignments, setAssignments] = useState<TutorGrupoAssignment[]>([]);
  const [canalizaciones, setCanalizaciones] = useState<CanalizacionRecord[]>([]);

  const loadOperationalData = useCallback(async () => {
    try {
      const [st, tut, asg, can] = await Promise.all([
        getAllStudentsForJefatura(),
        getTutorProfiles(),
        getAllTutorGroupAssignments(),
        getCanalizaciones(),
      ]);
      setStudents(st);
      setTutors(tut);
      setAssignments(asg);
      setCanalizaciones(can);
    } catch {
      // Fallback silencioso
    }
  }, []);

  useEffect(() => {
    loadOperationalData();
  }, [loadOperationalData, activeSection]);

  const pendingCanalizacionesCount = useMemo(
    () => canalizaciones.filter((c) => c.estado === "pendiente").length,
    [canalizaciones],
  );

  const handleLogout = () => {
    logout();
    toast.info("Has cerrado sesión.");
    navigate({ to: "/login", replace: true });
  };

  const handleExportOperativoCoberturaExcel = () => {
    const activeAsg = assignments.filter(
      (a) => a.activo !== false && (a.periodo || "2026-2") === activePeriodo,
    );

    const resumenRows = [
      { Indicador: "Periodo operativo", Valor: activePeriodo },
      { Indicador: "Total tutores activos", Valor: tutors.length },
      { Indicador: "Grupos asignados", Valor: activeAsg.length },
      {
        Indicador: "Grupos sin asignar (matriz 7x9x3)",
        Valor: Math.max(0, TESH_CAREERS.length * 27 - activeAsg.length),
      },
      { Indicador: "Estudiantes en padrón académico", Valor: students.length },
      { Indicador: "Canalizaciones pendientes", Valor: pendingCanalizacionesCount },
    ];

    const asignacionesRows = activeAsg.map((a) => ({
      Periodo: a.periodo || activePeriodo,
      Carrera: a.carrera,
      Semestre: `${a.semestre}º`,
      Grupo: a.grupo,
      Tutor: a.tutor_nombre || a.tutor_id,
      Estado: a.activo === false ? "Inactiva" : "Activa",
    }));

    const tutoresRows = tutors.map((t) => {
      const tGroups = activeAsg.filter((a) => a.tutor_id === t.id);
      const tCan = canalizaciones.filter((c) => c.tutor_id === t.id);
      return {
        Tutor: t.nombre,
        Clave: t.matricula || "TUT-TESH",
        Adscripcion: t.carrera || "TESH",
        "Grupos asignados": tGroups.length,
        "Canalizaciones totales": tCan.length,
        "Canalizaciones pendientes": tCan.filter((c) => c.estado === "pendiente").length,
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenRows), "Resumen Operativo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(asignacionesRows), "Asignaciones");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tutoresRows), "Carga Tutores");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Equilibra_TESH_Jefatura_Tutorias_${activePeriodo}_${stamp}.xlsx`);
    toast.success("Reporte operativo de tutorías descargado en Excel.");
  };

  const handleExportPadronEstudiantesExcel = () => {
    const rows = students.map((st) => ({
      Nombre: st.nombre,
      Matrícula: st.matricula,
      Carrera: st.carrera,
      Semestre: `${st.semestre}º`,
      Grupo: st.grupo,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Padrón Académico");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Equilibra_TESH_Padron_Grupos_${stamp}.xlsx`);
    toast.success("Padrón académico por grupo descargado en Excel.");
  };

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Jefatura de Carrera",
      onClick: () => setActiveSection("dashboard"),
    },
    {
      label: SECTION_LABELS[activeSection],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <InstitutionalHeader
        moduleTitle={`Jefatura de Carrera — ${SECTION_LABELS[activeSection]}`}
        breadcrumbs={breadcrumbs}
        onHomeClick={() => setActiveSection("dashboard")}
        onBackClick={() => {
          if (activeSection !== "dashboard") {
            setActiveSection("dashboard");
            return;
          }
          if (typeof window !== "undefined" && window.history.length > 1) {
            window.history.back();
            return;
          }
          navigate({ to: "/" });
        }}
        backFallbackRoute="/"
        showCrisisButton={false}
        showSidebarToggle={true}
        isSidebarOpen={isMobileSidebarOpen}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        sidebarOffsetClassName="lg:pl-64"
        actions={
          <>
            <AjustesModal
              rol="jefatura"
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
        <JefaturaSidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          pendingCanalizacionesCount={pendingCanalizacionesCount}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1 lg:pl-64">
          <main className="mx-auto w-full max-w-7xl p-4 pb-16 sm:p-6 lg:p-8">
            {activeSection === "dashboard" && (
              <JefaturaOverview
                tutors={tutors}
                assignments={assignments}
                students={students}
                canalizaciones={canalizaciones}
                activePeriodo={activePeriodo}
                onNavigateSection={setActiveSection}
              />
            )}

            {activeSection === "asignaciones" && (
              <TutoresAsignacionPanel
                selectedPeriodo={activePeriodo}
                onPeriodoChange={setActivePeriodo}
                onAssignmentsChanged={loadOperationalData}
              />
            )}

            {activeSection === "recursan" && (
              <EstudiantesRecursanPanel onStudentUpdated={loadOperationalData} />
            )}

            {activeSection === "canalizaciones" && <JefaturaCanalizacionesView />}

            {activeSection === "reportes" && (
              <div className="space-y-6">
                <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                  <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
                    Reportes operativos de Jefatura de Carrera
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                    Descarga en Excel (.xlsx) la cobertura de tutores por periodo y la distribución
                    de estudiantes por grupo y carrera.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Cobertura de tutores y carga operativa ({activePeriodo})
                        </h3>
                        <Grid3X3 className="size-5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Exporta grupos asignados, vacantes de la matriz 7×9×(A/B/C), y volumen de
                        canalizaciones por tutor en Excel.
                      </p>
                    </div>
                    <div className="mt-5">
                      <Button
                        type="button"
                        onClick={handleExportOperativoCoberturaExcel}
                        className="h-9 shrink-0 whitespace-nowrap rounded-lg bg-[#B8860B] px-4 text-xs font-semibold text-white hover:bg-[#D4A82B]"
                      >
                        <FileSpreadsheet className="mr-1.5 size-4" />
                        Descargar cobertura (.xlsx)
                      </Button>
                    </div>
                  </article>

                  <article className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Padrón académico por grupo (.xlsx)
                        </h3>
                        <Users className="size-5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Lista actualizada de estudiantes por carrera, semestre y grupo incluyendo
                        reubicaciones recientes de recursamiento.
                      </p>
                    </div>
                    <div className="mt-5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleExportPadronEstudiantesExcel}
                        className="h-9 shrink-0 whitespace-nowrap rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
                      >
                        <FileSpreadsheet className="mr-1.5 size-4" />
                        Descargar padrón (.xlsx)
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
