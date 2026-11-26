import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarX2,
  Check,
  CheckSquare,
  ClipboardList,
  Copy,
  FolderKanban,
  Info,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Users,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { TutorSidebar, type TutorNavSection } from "./tutor-sidebar";
import {
  TESH_PERIODOS_SUGERIDOS,
  createCanalizacionesBatch,
  getCanalizaciones,
  getGroupStudents,
  getTutorConsecutiveAbsenceAlerts,
  getTutorGroupAssignments,
  markAlertaAsRead,
  type CanalizacionEstado,
  type CanalizacionPrioridad,
  type CanalizacionRecord,
  type TutorGrupoAssignment,
  type TutorInasistenciaConsecutiva,
  type TutorStudentItem,
} from "./tutor-service";

type StudentAcademicStatus = "Activo" | "En seguimiento" | "Canalizado";
type StudentStatusFilter = "todos" | StudentAcademicStatus;

const SECTION_META: Record<TutorNavSection, { title: string; breadcrumb: string }> = {
  grupos: { title: "Tutoría Académica — Mis Grupos", breadcrumb: "Mis grupos" },
  estudiantes: { title: "Tutoría Académica — Estudiantes", breadcrumb: "Estudiantes" },
  alertas: {
    title: "Tutoría Académica — Alertas de Inasistencia",
    breadcrumb: "Alertas de inasistencia",
  },
  canalizaciones: {
    title: "Tutoría Académica — Canalizaciones",
    breadcrumb: "Canalizaciones",
  },
  perfil: { title: "Tutoría Académica — Mi Perfil", breadcrumb: "Mi perfil" },
};

const ESTADO_CANALIZACION_PILL: Record<CanalizacionEstado, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className: "bg-[#B8860B] text-white",
  },
  aceptada: {
    label: "Aceptada",
    className: "bg-[#1F4D2C] text-white",
  },
  rechazada: {
    label: "Rechazada",
    className: "bg-[#C8102E] text-white",
  },
  completada: {
    label: "Completada",
    className: "bg-[#8FC9B5] text-[#0F1A12]",
  },
};

const PRIORIDAD_LABEL: Record<CanalizacionPrioridad, string> = {
  baja: "Baja",
  normal: "Media",
  alta: "Alta",
  urgente: "Alta",
};

function getInitials(name?: string | null): string {
  const clean = (name || "").trim();
  if (!clean) return "ES";
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatFechaCorta(fechaStr?: string | null): string {
  if (!fechaStr) return "Sin registro";
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return "Reciente";
    return format(d, "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return "Reciente";
  }
}

export function TutorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [activeSection, setActiveSection] = useState<TutorNavSection>("grupos");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("2026-2");
  const [assignments, setAssignments] = useState<TutorGrupoAssignment[]>([]);
  const [studentsByGroup, setStudentsByGroup] = useState<Record<string, TutorStudentItem[]>>({});
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [absenceAlerts, setAbsenceAlerts] = useState<TutorInasistenciaConsecutiva[]>([]);
  const [canalizaciones, setCanalizaciones] = useState<CanalizacionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros y selección de estudiantes
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatusFilter>("todos");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Modal de canalización por observación propia del tutor
  const [canalizarTargets, setCanalizarTargets] = useState<TutorStudentItem[]>([]);
  const [motivoCanalizacion, setMotivoCanalizacion] = useState("");
  const [prioridadCanalizacion, setPrioridadCanalizacion] =
    useState<CanalizacionPrioridad>("normal");
  const [isSubmittingCanalizacion, setIsSubmittingCanalizacion] = useState(false);

  // Modal de contacto por 2 inasistencias consecutivas
  const [contactTarget, setContactTarget] = useState<TutorInasistenciaConsecutiva | null>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [isMarkingContacted, setIsMarkingContacted] = useState(false);

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const tutorGroups = await getTutorGroupAssignments(user.id, {
        name: user.name,
        carrera: user.carrera,
        grupo: user.grupo,
        semestre: user.semestre,
      });
      setAssignments(tutorGroups);

      const groupStudentPairs = await Promise.all(
        tutorGroups.map(async (g) => {
          const list = await getGroupStudents(g.carrera, g.grupo, g.semestre);
          return [g.id, list] as const;
        }),
      );

      const nextMap: Record<string, TutorStudentItem[]> = {};
      const allKnownStudents: TutorStudentItem[] = [];
      for (const [id, list] of groupStudentPairs) {
        nextMap[id] = list;
        allKnownStudents.push(...list);
      }
      setStudentsByGroup(nextMap);

      const [consecutiveAlerts, myCanalizaciones] = await Promise.all([
        getTutorConsecutiveAbsenceAlerts(user.id, allKnownStudents),
        getCanalizaciones({ tutorId: user.id }),
      ]);

      setAbsenceAlerts(consecutiveAlerts);
      setCanalizaciones(myCanalizaciones);

      setActiveGroupId((prev) => {
        if (prev && tutorGroups.some((g) => g.id === prev)) return prev;
        return tutorGroups[0]?.id || null;
      });
    } catch (err) {
      console.error("Error cargando panel del tutor:", err);
      toast.error("No se pudo actualizar la información del panel de tutoría.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.name, user?.carrera, user?.grupo, user?.semestre]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const filteredGroupsByPeriodo = useMemo(() => {
    return assignments.filter((g) => (g.periodo || "2026-2") === selectedPeriodo);
  }, [assignments, selectedPeriodo]);

  const activeGroup = useMemo(() => {
    return (
      filteredGroupsByPeriodo.find((g) => g.id === activeGroupId) ||
      assignments.find((g) => g.id === activeGroupId) ||
      filteredGroupsByPeriodo[0] ||
      assignments[0] ||
      null
    );
  }, [assignments, filteredGroupsByPeriodo, activeGroupId]);

  const activeStudents = useMemo(
    () => (activeGroup ? studentsByGroup[activeGroup.id] || [] : []),
    [activeGroup, studentsByGroup],
  );

  // Estado no clínico del estudiante derivado únicamente de canalizaciones administrativas
  const getStudentAcademicStatus = useCallback(
    (student: TutorStudentItem): StudentAcademicStatus => {
      const matches = canalizaciones.filter((c) => c.estudiante_id === student.id);
      if (matches.some((c) => c.estado === "pendiente")) {
        return "Canalizado";
      }
      if (matches.some((c) => c.estado === "aceptada")) {
        return "En seguimiento";
      }
      return "Activo";
    },
    [canalizaciones],
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeStudents.filter((st) => {
      const status = getStudentAcademicStatus(st);
      const matchesStatus = statusFilter === "todos" || status === statusFilter;
      const matchesQuery =
        q === "" || st.nombre.toLowerCase().includes(q) || st.matricula.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [activeStudents, searchQuery, statusFilter, getStudentAcademicStatus]);

  const selectableStudents = useMemo(
    () => filteredStudents.filter((st) => getStudentAcademicStatus(st) !== "Canalizado"),
    [filteredStudents, getStudentAcademicStatus],
  );

  const selectedStudentsList = useMemo(
    () => activeStudents.filter((st) => selectedStudentIds.includes(st.id)),
    [activeStudents, selectedStudentIds],
  );

  const allSelectableChecked =
    selectableStudents.length > 0 &&
    selectableStudents.every((st) => selectedStudentIds.includes(st.id));

  const pendingCanalizacionesCount = useMemo(
    () => canalizaciones.filter((c) => c.estado === "pendiente").length,
    [canalizaciones],
  );

  const handleSelectGroupAndOpenStudents = (groupId: string) => {
    setActiveGroupId(groupId);
    setSelectedStudentIds([]);
    setSearchQuery("");
    setStatusFilter("todos");
    setActiveSection("estudiantes");
  };

  const handleToggleStudent = (student: TutorStudentItem) => {
    if (getStudentAcademicStatus(student) === "Canalizado") return;
    setSelectedStudentIds((prev) =>
      prev.includes(student.id) ? prev.filter((id) => id !== student.id) : [...prev, student.id],
    );
  };

  const handleToggleSelectAll = () => {
    if (selectableStudents.length === 0) return;
    if (allSelectableChecked) {
      const selectableIdSet = new Set(selectableStudents.map((s) => s.id));
      setSelectedStudentIds((prev) => prev.filter((id) => !selectableIdSet.has(id)));
    } else {
      const next = new Set([...selectedStudentIds, ...selectableStudents.map((s) => s.id)]);
      setSelectedStudentIds(Array.from(next));
    }
  };

  const handleOpenCanalizarModal = (targets: TutorStudentItem[]) => {
    const elegibles = targets.filter((t) => getStudentAcademicStatus(t) !== "Canalizado");
    if (elegibles.length === 0) {
      toast.info("Los estudiantes seleccionados ya cuentan con una canalización pendiente.");
      return;
    }
    setCanalizarTargets(elegibles);
    setMotivoCanalizacion("");
    setPrioridadCanalizacion("normal");
  };

  const handleSubmitCanalizacion = async () => {
    if (canalizarTargets.length === 0 || !user?.id) return;
    if (!motivoCanalizacion.trim()) {
      toast.error("Describe el motivo de canalización basado en tu observación académica.");
      return;
    }

    setIsSubmittingCanalizacion(true);
    try {
      const { created, errors } = await createCanalizacionesBatch({
        tutor_id: user.id,
        tutor_nombre: user.name,
        estudiantes: canalizarTargets,
        motivo: motivoCanalizacion.trim(),
        prioridad: prioridadCanalizacion,
      });

      if (created.length > 0) {
        setCanalizaciones((prev) => [...created, ...prev]);
        const createdIds = new Set(created.map((c) => c.estudiante_id));
        setSelectedStudentIds((prev) => prev.filter((id) => !createdIds.has(id)));

        toast.success(
          created.length === 1
            ? `Canalización enviada para ${created[0].estudiante_nombre || "1 estudiante"}.`
            : `${created.length} canalizaciones enviadas correctamente.`,
          {
            style: {
              backgroundColor: "#E0F0E8",
              borderColor: "#8FC9B5",
              color: "#0F1A12",
            },
          },
        );
      }

      if (errors.length > 0) {
        toast.error(`No se pudo completar un registro: ${errors[0]}`);
      }

      if (created.length > 0) {
        setCanalizarTargets([]);
        setMotivoCanalizacion("");
      }
    } finally {
      setIsSubmittingCanalizacion(false);
    }
  };

  const handleOpenContactModal = (alerta: TutorInasistenciaConsecutiva) => {
    const fechasTexto =
      alerta.fechas_faltantes.length > 0
        ? alerta.fechas_faltantes.join(" y ")
        : "las últimas dos sesiones";
    const template = `Hola ${alerta.estudiante_nombre}, soy ${user?.name || "tu tutor académico"} del TESH. Notamos que registraste 2 inasistencias consecutivas (${fechasTexto}). Me gustaría conversar contigo en tutoría para apoyarte académicamente y verificar que todo esté bien. ¿Qué horario te funciona esta semana?`;
    setContactTarget(alerta);
    setContactMessage(template);
  };

  const handleCopyContactMessage = async () => {
    if (!contactMessage.trim()) return;
    try {
      await navigator.clipboard.writeText(contactMessage);
      toast.success("Plantilla de mensaje copiada al portapapeles.");
    } catch {
      toast.info("Selecciona y copia el mensaje manualmente desde el cuadro de texto.");
    }
  };

  const handleConfirmContactSent = async () => {
    if (!contactTarget) return;
    setIsMarkingContacted(true);
    try {
      await Promise.all(contactTarget.alert_ids.map((id) => markAlertaAsRead(id)));
      setAbsenceAlerts((prev) => prev.filter((a) => a.id !== contactTarget.id));
      toast.success(`Seguimiento de contacto registrado para ${contactTarget.estudiante_nombre}.`, {
        style: {
          backgroundColor: "#E0F0E8",
          borderColor: "#8FC9B5",
          color: "#0F1A12",
        },
      });
      setContactTarget(null);
      setContactMessage("");
    } finally {
      setIsMarkingContacted(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.info("Has cerrado sesión institucional.");
    navigate({ to: "/login", replace: true });
  };

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Tutoría Académica",
      onClick: () => setActiveSection("grupos"),
    },
    {
      label: SECTION_META[activeSection].breadcrumb,
    },
    ...(activeSection === "estudiantes" && activeGroup
      ? [{ label: `${activeGroup.carrera} · Grupo ${activeGroup.grupo}` }]
      : []),
  ];

  const availablePeriods = useMemo(() => {
    const fromAssignments = assignments.map((a) => a.periodo || "2026-2");
    return Array.from(new Set([...TESH_PERIODOS_SUGERIDOS, ...fromAssignments]));
  }, [assignments]);

  return (
    <div className="min-h-screen bg-[#F5F1E8] dark:bg-background text-foreground flex flex-col">
      <InstitutionalHeader
        moduleTitle={SECTION_META[activeSection].title}
        breadcrumbs={breadcrumbs}
        onHomeClick={() => setActiveSection("grupos")}
        onBackClick={() => {
          if (activeSection !== "grupos") {
            setActiveSection("grupos");
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
        roleLabel="Tutor de Grupo"
        showSidebarToggle={true}
        isSidebarOpen={isMobileSidebarOpen}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        sidebarOffsetClassName="lg:pl-64"
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadDashboardData}
              className="h-9 cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCw
                className={`size-4 sm:mr-1.5 ${isLoading ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            <ThemeToggle className="size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none backdrop-blur-none hover:scale-100 hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white" />
          </>
        }
      />

      <div className="flex flex-1 min-w-0">
        <TutorSidebar
          activeSection={activeSection}
          onSelectSection={(sec) => setActiveSection(sec)}
          absenceAlertsCount={absenceAlerts.length}
          pendingCanalizacionesCount={pendingCanalizacionesCount}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0 lg:pl-64">
          <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8 pb-16">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSection}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-6"
              >
                {/* =========================================================
                   1. SECCIÓN: MIS GRUPOS
                   ========================================================= */}
                {activeSection === "grupos" && (
                  <section className="space-y-5">
                    <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Mis grupos asignados
                        </h2>
                        <p className="mt-0.5 text-xs sm:text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Consulta tus grupos del periodo académico y canaliza por observación
                          propia.
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Label
                          htmlFor="tutor-periodo-select"
                          className="text-xs font-semibold text-[#1F4D2C] whitespace-nowrap dark:text-[#8FC9B5]"
                        >
                          Periodo:
                        </Label>
                        <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
                          <SelectTrigger
                            id="tutor-periodo-select"
                            className="h-9 w-44 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
                          >
                            <SelectValue placeholder="Semestre actual" />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                            {availablePeriods.map((periodo) => (
                              <SelectItem key={periodo} value={periodo} className="text-xs">
                                {periodo === "2026-2" ? `${periodo} (Actual)` : periodo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {isLoading && assignments.length === 0 ? (
                      <div className="space-y-3">
                        {[1, 2].map((idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                          >
                            <div className="space-y-2">
                              <Skeleton className="h-5 w-72" />
                              <Skeleton className="h-4 w-44" />
                            </div>
                            <Skeleton className="h-9 w-32 rounded-lg" />
                          </div>
                        ))}
                      </div>
                    ) : filteredGroupsByPeriodo.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E5DFD3] bg-white p-10 text-center space-y-2 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <FolderKanban className="mx-auto size-8 text-[#6B6B6B]" />
                        <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          No tienes grupos asignados en el periodo {selectedPeriodo}
                        </p>
                        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Selecciona otro periodo o solicita tu asignación a Jefatura de Carrera.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredGroupsByPeriodo.map((group) => {
                          const groupList = studentsByGroup[group.id] || [];
                          const totalCount = groupList.length;
                          const canalizadosGroupCount = groupList.filter(
                            (st) => getStudentAcademicStatus(st) !== "Activo",
                          ).length;

                          return (
                            <article
                              key={group.id}
                              className="flex flex-col gap-4 rounded-lg border border-[#E5DFD3] bg-white p-5 transition-colors hover:border-[#1F4D2C]/50 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                            >
                              <div className="min-w-0 space-y-1.5">
                                <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                  {group.carrera} — Grupo {group.grupo} — {group.semestre}º semestre
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                                    <Users className="size-3.5" strokeWidth={1.75} />
                                    {totalCount} {totalCount === 1 ? "estudiante" : "estudiantes"}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">
                                    Periodo {group.periodo || "2026-2"}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums">
                                    {canalizadosGroupCount} con seguimiento/canalización
                                  </span>
                                </div>
                              </div>

                              <Button
                                type="button"
                                onClick={() => handleSelectGroupAndOpenStudents(group.id)}
                                className="h-10 shrink-0 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                              >
                                <Users className="mr-1.5 size-4" />
                                Ver estudiantes
                              </Button>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {/* =========================================================
                   2. SECCIÓN: ESTUDIANTES (LISTA ACADÉMICA + MULTI-SELECCIÓN)
                   ========================================================= */}
                {activeSection === "estudiantes" && (
                  <section className="space-y-5">
                    <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                      <div className="space-y-1">
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Lista de estudiantes
                        </h2>
                        <p className="text-xs sm:text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {activeGroup
                            ? `${activeGroup.carrera} — Grupo ${activeGroup.grupo} — ${activeGroup.semestre}º semestre`
                            : "Selecciona un grupo asignado para consultar sus estudiantes."}
                        </p>
                      </div>

                      <Button
                        type="button"
                        disabled={selectedStudentsList.length === 0}
                        onClick={() => handleOpenCanalizarModal(selectedStudentsList)}
                        className="h-10 shrink-0 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59] disabled:opacity-50"
                      >
                        <UserPlus className="mr-1.5 size-4" />
                        <span>
                          Canalizar seleccionados
                          {selectedStudentsList.length > 0
                            ? ` (${selectedStudentsList.length})`
                            : ""}
                        </span>
                      </Button>
                    </div>

                    <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 space-y-4 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      {/* Controles de grupo, búsqueda y filtro de estado */}
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                          <Select
                            value={activeGroup?.id || ""}
                            onValueChange={(id) => {
                              setActiveGroupId(id);
                              setSelectedStudentIds([]);
                            }}
                          >
                            <SelectTrigger
                              aria-label="Seleccionar grupo"
                              className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                            >
                              <SelectValue placeholder="Selecciona un grupo" />
                            </SelectTrigger>
                            <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                              {assignments.map((g) => (
                                <SelectItem key={g.id} value={g.id} className="text-xs">
                                  {g.carrera} — Grupo {g.grupo} ({g.semestre}º)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="relative lg:col-span-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6B6B6B]" />
                          <Input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nombre o matrícula..."
                            aria-label="Buscar estudiante por nombre o matrícula"
                            className="h-9 rounded-lg border-[#E5DFD3] bg-white pl-9 text-xs text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                          />
                        </div>

                        <div className="flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-1 lg:col-span-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                          {(["todos", "Activo", "En seguimiento", "Canalizado"] as const).map(
                            (tab) => {
                              const active = statusFilter === tab;
                              return (
                                <button
                                  key={tab}
                                  type="button"
                                  onClick={() => setStatusFilter(tab)}
                                  className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                                    active
                                      ? "bg-white text-[#1F4D2C] shadow-2xs dark:bg-[#1A2618] dark:text-[#8FC9B5]"
                                      : "text-[#6B6B6B] hover:text-[#1A1A1A] dark:text-[#A6B5A3] dark:hover:text-[#F5F1E8]"
                                  }`}
                                >
                                  {tab === "todos" ? "Todos" : tab}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>

                      {/* Barra de selección múltiple */}
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 px-3.5 py-2.5 dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60">
                        <div className="flex items-center gap-2.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={selectableStudents.length === 0}
                            onClick={handleToggleSelectAll}
                            className="h-8 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]"
                          >
                            <CheckSquare className="mr-1.5 size-3.5" />
                            {allSelectableChecked ? "Deseleccionar todos" : "Seleccionar todos"}
                          </Button>
                          <span className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {selectedStudentIds.length > 0
                              ? `${selectedStudentIds.length} estudiante(s) seleccionado(s)`
                              : "Selecciona estudiantes para canalizar en conjunto"}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                          Mostrando {filteredStudents.length} de {activeStudents.length}
                        </span>
                      </div>

                      {/* Tabla de estudiantes (sin datos clínicos LFPDPPP) */}
                      <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
                        <Table>
                          <TableHeader className="bg-[#F5F1E8] dark:bg-[#0F1A12]">
                            <TableRow className="border-b border-[#E5DFD3] hover:bg-transparent dark:border-[#2D3F2A]">
                              <TableHead className="w-11 py-3 text-center">
                                <Checkbox
                                  checked={allSelectableChecked}
                                  disabled={selectableStudents.length === 0}
                                  onCheckedChange={handleToggleSelectAll}
                                  aria-label="Seleccionar todos los estudiantes disponibles"
                                />
                              </TableHead>
                              <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                Estudiante
                              </TableHead>
                              <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                Matrícula
                              </TableHead>
                              <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                Estado
                              </TableHead>
                              <TableHead className="py-3 pr-4 text-right text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                Acción
                              </TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                            {filteredStudents.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={5}
                                  className="py-10 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]"
                                >
                                  No hay estudiantes que coincidan con los filtros actuales.
                                </TableCell>
                              </TableRow>
                            ) : (
                              filteredStudents.map((st) => {
                                const academicStatus = getStudentAcademicStatus(st);
                                const isCanalizado = academicStatus === "Canalizado";
                                const isChecked =
                                  !isCanalizado && selectedStudentIds.includes(st.id);

                                return (
                                  <TableRow
                                    key={st.id}
                                    className={`transition-colors ${
                                      isChecked
                                        ? "bg-[#1F4D2C]/[0.06] dark:bg-[#1F4D2C]/20"
                                        : "bg-white hover:bg-[#F5F1E8]/60 dark:bg-[#1A2618] dark:hover:bg-[#0F1A12]/40"
                                    }`}
                                  >
                                    <TableCell className="py-3 text-center">
                                      <Checkbox
                                        checked={isChecked}
                                        disabled={isCanalizado}
                                        onCheckedChange={() => handleToggleStudent(st)}
                                        aria-label={`Seleccionar a ${st.nombre}`}
                                      />
                                    </TableCell>

                                    <TableCell className="py-3">
                                      <div className="flex items-center gap-3">
                                        <div
                                          aria-hidden="true"
                                          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#E5DFD3] bg-[#F5F1E8] text-xs font-bold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]"
                                        >
                                          {getInitials(st.nombre)}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                            {st.nombre}
                                          </p>
                                          <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                            Grupo {st.grupo} · {st.semestre}º semestre
                                          </p>
                                        </div>
                                      </div>
                                    </TableCell>

                                    <TableCell className="py-3 font-mono text-xs font-semibold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                                      {st.matricula}
                                    </TableCell>

                                    <TableCell className="py-3">
                                      <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                          academicStatus === "Canalizado"
                                            ? "bg-[#B8860B] text-white"
                                            : academicStatus === "En seguimiento"
                                              ? "bg-[#1F4D2C] text-white"
                                              : "border border-[#E5DFD3] bg-[#F5F1E8] text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                                        }`}
                                      >
                                        {academicStatus}
                                      </span>
                                    </TableCell>

                                    <TableCell className="py-3 pr-4 text-right">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={isCanalizado}
                                        onClick={() => handleOpenCanalizarModal([st])}
                                        className="h-9 rounded-lg px-3 text-xs font-semibold text-[#1F4D2C] hover:bg-[#1F4D2C]/10 hover:text-[#1F4D2C] disabled:opacity-45 dark:text-[#8FC9B5] dark:hover:bg-[#8FC9B5]/10"
                                      >
                                        <UserPlus className="mr-1.5 size-3.5" />
                                        <span>{isCanalizado ? "Pendiente" : "Canalizar"}</span>
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </section>
                )}

                {/* =========================================================
                   3. SECCIÓN: ALERTAS DE INASISTENCIA (2 no_asistio consecutivos)
                   ========================================================= */}
                {activeSection === "alertas" && (
                  <section className="space-y-5">
                    <div className="flex flex-col gap-2 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Alertas de inasistencia
                        </h2>
                        <p className="mt-0.5 text-xs sm:text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Estudiantes de tus grupos con 2 inasistencias consecutivas (
                          <span className="font-mono">no_asistio</span>) pendientes de contacto
                          tutorial.
                        </p>
                      </div>
                      <span className="inline-flex w-fit items-center rounded-md border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] tabular-nums dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
                        {absenceAlerts.length} alerta(s) activa(s)
                      </span>
                    </div>

                    {absenceAlerts.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E5DFD3] bg-white p-10 text-center space-y-2 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <Check className="mx-auto size-8 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                        <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          No hay alertas por 2 inasistencias consecutivas pendientes
                        </p>
                        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Cuando un estudiante acumule 2 faltas consecutivas aparecerá aquí para
                          seguimiento académico.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {absenceAlerts.map((alerta) => (
                          <article
                            key={alerta.id}
                            className="flex flex-col gap-4 rounded-lg border border-[#E5DFD3] bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#C8102E]">
                                <CalendarX2 className="size-5" strokeWidth={1.75} />
                              </div>

                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-sm sm:text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                    {alerta.estudiante_nombre}
                                  </h3>
                                  <span className="font-mono text-xs font-semibold text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                    {alerta.matricula}
                                  </span>
                                  {alerta.grupo && (
                                    <span className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                      · Grupo {alerta.grupo}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                  <span className="font-semibold text-[#C8102E]">
                                    2 inasistencias consecutivas:
                                  </span>{" "}
                                  Fechas faltantes:{" "}
                                  <span className="font-medium text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                                    {alerta.fechas_faltantes.join(" · ")}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <Button
                              type="button"
                              onClick={() => handleOpenContactModal(alerta)}
                              className="h-10 shrink-0 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                            >
                              <Mail className="mr-1.5 size-4" />
                              Contactar
                            </Button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* =========================================================
                   4. SECCIÓN: CANALIZACIONES (ESTADO VISIBLE PARA TUTOR)
                   ========================================================= */}
                {activeSection === "canalizaciones" && (
                  <section className="space-y-5">
                    <div className="flex flex-col gap-2 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Seguimiento de canalizaciones
                        </h2>
                        <p className="mt-0.5 text-xs sm:text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Estado administrativo de las canalizaciones enviadas por observación
                          propia (sin acceso a notas ni evaluaciones clínicas).
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setActiveSection("estudiantes")}
                        className="h-10 w-fit rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                      >
                        <UserPlus className="mr-1.5 size-4" />
                        Nueva canalización
                      </Button>
                    </div>

                    <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      {canalizaciones.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[#E5DFD3] p-10 text-center space-y-2 dark:border-[#2D3F2A]">
                          <ClipboardList className="mx-auto size-8 text-[#6B6B6B]" />
                          <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            Aún no has enviado canalizaciones
                          </p>
                          <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                            Puedes canalizar estudiantes desde la sección Estudiantes cuando
                            observes señales académicas que requieran apoyo.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
                          <Table>
                            <TableHeader className="bg-[#F5F1E8] dark:bg-[#0F1A12]">
                              <TableRow className="border-b border-[#E5DFD3] hover:bg-transparent dark:border-[#2D3F2A]">
                                <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                  Estudiante
                                </TableHead>
                                <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                  Motivo (observación del tutor)
                                </TableHead>
                                <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                  Prioridad
                                </TableHead>
                                <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                  Estado
                                </TableHead>
                                <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                  Fecha
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                              {canalizaciones.map((c) => {
                                const estadoPill =
                                  ESTADO_CANALIZACION_PILL[c.estado] ||
                                  ESTADO_CANALIZACION_PILL.pendiente;
                                const prioridadTexto = PRIORIDAD_LABEL[c.prioridad] || "Media";

                                return (
                                  <TableRow
                                    key={c.id}
                                    className="bg-white hover:bg-[#F5F1E8]/50 dark:bg-[#1A2618] dark:hover:bg-[#0F1A12]/40"
                                  >
                                    <TableCell className="py-3">
                                      <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                        {c.estudiante_nombre || "Estudiante asignado"}
                                      </p>
                                      {c.grupo && (
                                        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                          Grupo {c.grupo}
                                          {c.semestre ? ` · ${c.semestre}º semestre` : ""}
                                        </p>
                                      )}
                                    </TableCell>

                                    <TableCell className="max-w-md py-3 text-xs text-[#1A1A1A] dark:text-[#F5F1E8]">
                                      <p className="line-clamp-2 leading-relaxed">{c.motivo}</p>
                                    </TableCell>

                                    <TableCell className="py-3 text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                                      {prioridadTexto}
                                    </TableCell>

                                    <TableCell className="py-3">
                                      <span
                                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoPill.className}`}
                                      >
                                        {estadoPill.label}
                                      </span>
                                    </TableCell>

                                    <TableCell className="py-3 whitespace-nowrap text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                      {formatFechaCorta(c.created_at)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* =========================================================
                   5. SECCIÓN: MI PERFIL
                   ========================================================= */}
                {activeSection === "perfil" && (
                  <section className="space-y-5">
                    <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                        Mi perfil institucional
                      </h2>
                      <p className="mt-0.5 text-xs sm:text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Información de cuenta tutorial y lineamientos de privacidad LFPDPPP.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                      <div className="rounded-lg border border-[#E5DFD3] bg-white p-6 space-y-5 lg:col-span-2 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <div className="flex items-center gap-4">
                          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-[#E5DFD3] bg-[#F5F1E8] text-lg font-bold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                            {getInitials(user?.name)}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                              {user?.name || "Tutor Académico TESH"}
                            </h3>
                            <p className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                              Tutor de Grupo · Tecnológico de Estudios Superiores de Huixquilucan
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 border-t border-[#E5DFD3] pt-4 sm:grid-cols-2 dark:border-[#2D3F2A]">
                          <div>
                            <p className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                              Correo institucional
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                              {user?.email || "tutor@tesh.edu.mx"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                              Grupos asignados ({selectedPeriodo})
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                              {filteredGroupsByPeriodo.length} grupo(s) activo(s)
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DFD3] pt-4 dark:border-[#2D3F2A]">
                          <span className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                            ¿Necesitas actualizar tu contraseña o datos de cuenta?
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate({ to: "/perfil" })}
                            className="h-9 rounded-lg border-[#1F4D2C] text-xs font-semibold text-[#1F4D2C] hover:bg-[#1F4D2C]/10 dark:border-[#8FC9B5] dark:text-[#8FC9B5]"
                          >
                            <UserCircle className="mr-1.5 size-4" />
                            Administrar cuenta completa
                          </Button>
                        </div>
                      </div>

                      <aside className="rounded-lg border border-[#E5DFD3] bg-white p-6 space-y-3 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <div className="flex items-center gap-2 text-[#1F4D2C] dark:text-[#8FC9B5]">
                          <ShieldCheck className="size-5 shrink-0" />
                          <h3 className="text-sm font-bold">Privacidad LFPDPPP</h3>
                        </div>
                        <p className="text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Conforme a la Ley Federal de Protección de Datos Personales en Posesión de
                          los Particulares, el rol de Tutoría Académica opera únicamente con datos
                          de identificación académica y observación propia.
                        </p>
                        <ul className="space-y-1.5 border-t border-[#E5DFD3] pt-3 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                          <li>· Sin acceso a resultados GAD-7 o PHQ-9</li>
                          <li>· Sin acceso a expedientes ni notas clínicas</li>
                          <li>· Seguimiento administrativo de canalizaciones</li>
                        </ul>
                      </aside>
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* =====================================================================
         MODAL DE CANALIZACIÓN POR OBSERVACIÓN PROPIA DEL TUTOR
         ===================================================================== */}
      <Dialog
        open={canalizarTargets.length > 0}
        onOpenChange={(open) => {
          if (!open && !isSubmittingCanalizacion) {
            setCanalizarTargets([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
              {canalizarTargets.length === 1
                ? "Canalizar estudiante al área psicológica"
                : `Canalizar ${canalizarTargets.length} estudiantes al área psicológica`}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Registra la canalización a partir de observación académica directa en tutoría.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nombres de estudiantes seleccionados */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                Estudiante(s) seleccionado(s)
              </Label>
              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-2.5 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                {canalizarTargets.map((target) => (
                  <div
                    key={target.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                  >
                    <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {target.nombre}
                    </span>
                    <span className="font-mono text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                      {target.matricula}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Select de prioridad: Baja / Media / Alta */}
            <div className="space-y-1.5">
              <Label
                htmlFor="tutor-canalizacion-prioridad"
                className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Prioridad de observación
              </Label>
              <Select
                value={prioridadCanalizacion}
                onValueChange={(v) => setPrioridadCanalizacion(v as CanalizacionPrioridad)}
              >
                <SelectTrigger
                  id="tutor-canalizacion-prioridad"
                  className="h-10 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  <SelectValue placeholder="Selecciona prioridad" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                  <SelectItem value="baja" className="text-sm">
                    Baja
                  </SelectItem>
                  <SelectItem value="normal" className="text-sm">
                    Media
                  </SelectItem>
                  <SelectItem value="alta" className="text-sm">
                    Alta
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Textarea motivo */}
            <div className="space-y-1.5">
              <Label
                htmlFor="tutor-canalizacion-motivo"
                className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Motivo de canalización (observación propia, NO datos clínicos)
              </Label>
              <Textarea
                id="tutor-canalizacion-motivo"
                rows={4}
                required
                value={motivoCanalizacion}
                onChange={(e) => setMotivoCanalizacion(e.target.value)}
                placeholder="Ej. Inasistencias recientes en clase, descenso en entrega de actividades o solicitud directa de apoyo por el estudiante..."
                className="rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
              />
            </div>

            {/* Aviso LFPDPPP */}
            <div className="flex items-start gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-3 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
              <Info className="mt-0.5 size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
              <p>
                El tutor canaliza por observación académica. No accede a resultados clínicos del
                tamizaje.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingCanalizacion}
              onClick={() => setCanalizarTargets([])}
              className="h-11 rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#F5F1E8]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSubmittingCanalizacion || !motivoCanalizacion.trim()}
              onClick={handleSubmitCanalizacion}
              className="h-11 rounded-lg bg-[#B8860B] px-5 text-xs font-semibold text-white hover:bg-[#D4A82B] disabled:opacity-50"
            >
              <Send className="mr-1.5 size-4" />
              {isSubmittingCanalizacion ? "Enviando..." : "Enviar canalización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
         MODAL DE CONTACTO POR 2 INASISTENCIAS CONSECUTIVAS
         ===================================================================== */}
      <Dialog
        open={Boolean(contactTarget)}
        onOpenChange={(open) => {
          if (!open && !isMarkingContacted) {
            setContactTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
              Contactar a {contactTarget?.estudiante_nombre}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Matrícula <span className="font-mono font-semibold">{contactTarget?.matricula}</span>{" "}
              · Fechas faltantes:{" "}
              <span className="font-semibold">{contactTarget?.fechas_faltantes.join(" · ")}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label
              htmlFor="tutor-contact-template"
              className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
            >
              Plantilla de mensaje institucional
            </Label>
            <Textarea
              id="tutor-contact-template"
              rows={5}
              value={contactMessage}
              onChange={(e) => setContactMessage(e.target.value)}
              className="rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
            />
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyContactMessage}
              className="h-10 rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
            >
              <Copy className="mr-1.5 size-3.5" />
              Copiar mensaje
            </Button>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={isMarkingContacted}
                onClick={() => setContactTarget(null)}
                className="h-10 rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1A1A1A] dark:border-[#2D3F2A] dark:text-[#F5F1E8]"
              >
                Cerrar
              </Button>
              <Button
                type="button"
                disabled={isMarkingContacted || !contactMessage.trim()}
                onClick={handleConfirmContactSent}
                className="h-10 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
              >
                <Check className="mr-1.5 size-3.5" />
                {isMarkingContacted ? "Registrando..." : "Registrar contacto"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
