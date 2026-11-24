import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  UsersRound,
  CalendarPlus,
  PhoneCall,
  Search,
  Calendar,
  Clock,
  ShieldAlert,
  FolderOpen,
  ChevronDown,
  Users,
  Settings,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NotificationsCenter } from "@/components/notifications/notifications-center";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { PsychologistSidebar, type PsychologistNavSection } from "./psychologist-sidebar";
import { PsychologistOverview } from "./psychologist-overview";
import { ExpedientesPage } from "./expedientes-page";
import { CaseDetailSheet } from "./case-detail-sheet";
import { ScheduleSessionDialog } from "./schedule-session-dialog";
import { ContactPatientDialog } from "./contact-patient-dialog";
import { CrisisProtocolDialog } from "./crisis-protocol-dialog";
import { PsychologistAgenda } from "./psychologist-agenda";
import { ClinicalNotesFeed } from "./clinical-notes-feed";
import { GestionRecursos } from "./recursos/gestion-recursos";
import { SemaforoPacientes } from "./semaforo-pacientes";
import { ExpedienteClinico } from "./ExpedienteClinico";
import { ResultadosEncuesta } from "./ResultadosEncuesta";
import { CanalizacionesPanel } from "./canalizaciones-panel";
import { getCanalizaciones } from "@/features/tutor/tutor-service";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { useAuth } from "@/lib/auth-context";
import {
  getPsychologistCases,
  getStoredAppointments,
  updateCaseStatus,
} from "@/lib/psychologist-store";
import { supabase } from "@/integrations/supabase/client";
import type { CaseSummary, RiskLevel, CaseStatus, Appointment } from "@/lib/types";

const riskStyles: Record<
  RiskLevel,
  { label: string; dot: string; surface: string; border: string }
> = {
  rojo: {
    label: "Riesgo alto",
    dot: "bg-[#C8102E]",
    surface: "bg-[#FEE2E2] text-[#C8102E] border-[#C8102E]/30",
    border: "border-[#E5DFD3]",
  },
  amarillo: {
    label: "Seguimiento",
    dot: "bg-[#B8860B]",
    surface: "bg-[#FBE6D5] text-[#B8860B] border-[#B8860B]/30",
    border: "border-[#E5DFD3]",
  },
  verde: {
    label: "Estable",
    dot: "bg-[#1F4D2C]",
    surface: "bg-[#E0F0E8] text-[#1F4D2C] border-[#1F4D2C]/30",
    border: "border-[#E5DFD3]",
  },
};

const statusLabels: Record<CaseStatus, { label: string; surface: string }> = {
  por_contactar: {
    label: "Por contactar",
    surface: "bg-[#FBE6D5] text-[#B8860B] border-[#B8860B]/30",
  },
  en_seguimiento: {
    label: "En seguimiento",
    surface: "bg-[#F5F1E8] text-[#1F4D2C] border-[#E5DFD3]",
  },
  cita_programada: {
    label: "Cita programada",
    surface: "bg-[#E0F0E8] text-[#1F4D2C] border-[#1F4D2C]/30 font-semibold",
  },
  atendido: {
    label: "Atendido / Estable",
    surface: "bg-[#E0F0E8] text-[#1F4D2C] border-[#1F4D2C]/30",
  },
};

const TESH_CAREERS = [
  "Ing. Civil",
  "Ing. Industrial",
  "Ing. Mecatrónica",
  "Ing. en Sistemas Computacionales",
  "Lic. en Administración",
  "Lic. en Biología",
  "Lic. en Gastronomía",
] as const;

const TESH_SEMESTERS = [
  "1º Semestre",
  "2º Semestre",
  "3º Semestre",
  "4º Semestre",
  "5º Semestre",
  "6º Semestre",
  "7º Semestre",
  "8º Semestre",
  "9º Semestre",
] as const;

const PAGE_SIZE = 6;

const chipClass = (isActive: boolean) =>
  `inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border shrink-0 cursor-pointer ${
    isActive
      ? "bg-[#1F4D2C] text-white border-[#1F4D2C] hover:bg-[#4A7C59]"
      : "bg-white text-[#1A1A1A] border-[#E5DFD3] hover:border-[#1F4D2C]/50 hover:bg-[#F5F1E8]"
  }`;

const SECTION_META: Record<PsychologistNavSection, { title: string; breadcrumb: string }> = {
  resumen: { title: "Resumen Clínico", breadcrumb: "Resumen" },
  alertas: { title: "Triaje de Alertas y Casos", breadcrumb: "Alertas" },
  expedientes: { title: "Expedientes Clínicos", breadcrumb: "Expedientes" },
  agenda: { title: "Agenda de Citas", breadcrumb: "Agenda" },
  bitacora: { title: "Bitácora Clínica", breadcrumb: "Bitácora" },
  encuestas: { title: "Encuestas de Satisfacción", breadcrumb: "Encuestas" },
  canalizaciones: { title: "Canalizaciones de Tutores", breadcrumb: "Canalizaciones" },
  recursos: {
    title: "Recursos y Videos",
    breadcrumb: "Recursos y Videos",
  },
};

export function PsychologistDashboard({
  initialSection = "resumen",
}: {
  initialSection?: PsychologistNavSection;
} = {}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [activeSection, setActiveSection] = useState<PsychologistNavSection>(initialSection);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeRiskFilter, setActiveRiskFilter] = useState<RiskLevel | null>(null);
  const [selectedCareer, setSelectedCareer] = useState<string>("all");
  const [selectedSemester, setSelectedSemester] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [alertasViewMode, setAlertasViewMode] = useState<"semaforo" | "tarjetas">("semaforo");

  const [cases, setCases] = useState<CaseSummary[]>(() => getPsychologistCases());
  const [appointments, setAppointments] = useState<Appointment[]>(() => getStoredAppointments());
  const [pendingCanalizacionesCount, setPendingCanalizacionesCount] = useState(0);

  const [selectedCaseForDetail, setSelectedCaseForDetail] = useState<CaseSummary | null>(null);
  const [expedienteFolioModal, setExpedienteFolioModal] = useState<string | null>(null);
  const [scheduleDialogCase, setScheduleDialogCase] = useState<CaseSummary | null>(null);
  const [contactDialogCase, setContactDialogCase] = useState<CaseSummary | null>(null);
  const [crisisDialogCase, setCrisisDialogCase] = useState<CaseSummary | null>(null);

  const refreshCases = async () => {
    const localCases = getPsychologistCases();
    try {
      const { data: viewData, error: viewError } = await supabase
        .from("para_psicologo")
        .select("*");

      if (!viewError && Array.isArray(viewData) && viewData.length > 0) {
        const viewCases: CaseSummary[] = viewData.map((p) => {
          const dateStr = p.ultimo_tamizaje
            ? new Date(p.ultimo_tamizaje).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Reciente";
          const nivel = (p.ultimo_nivel?.toLowerCase() || "amarillo") as RiskLevel;

          return {
            id: p.folio || `case-${p.iniciales}`,
            initials: p.iniciales || "E.A.",
            studentName: `Estudiante ${p.iniciales || ""}`.trim(),
            matricula: p.folio || "TESH",
            career: p.carrera || "TESH Huixquilucan",
            semester: p.semestre ? `${p.semestre}º Semestre` : "Semestre no especificado",
            riskLevel: nivel,
            status: (p.bloqueado ? "por_contactar" : "atendido") as CaseStatus,
            summary: `Tamizaje registrado (Folio: ${p.folio || "N/A"}). ${
              nivel === "rojo" ? "Riesgo alto prioritario." : "En seguimiento."
            }`,
            lastCheckIn: dateStr,
            accompanimentSummary: `Paciente evaluado en tamizaje con folio ${p.folio || "N/A"}.`,
            phq9: p.phq9_total ?? 0,
            gad7: p.gad7_total ?? 0,
            bloqueado: Boolean(p.bloqueado),
          };
        });

        const existingIds = new Set(viewCases.map((c) => c.id));
        const merged = [...viewCases, ...localCases.filter((c) => !existingIds.has(c.id))];
        setCases(merged);
        return;
      }

      let { data: dbPatients, error } = await supabase
        .from("pacientes")
        .select("*")
        .order("fecha_registro", { ascending: false });

      if (error && error.message.includes("does not exist")) {
        const fallback = await supabase
          .from("pacientes")
          .select("*")
          .order("id", { ascending: false });
        dbPatients = fallback.data;
        error = fallback.error;
      }

      if (!error && Array.isArray(dbPatients) && dbPatients.length > 0) {
        const dbCases: CaseSummary[] = dbPatients.map((p) => {
          const dateStr = p.fecha_registro
            ? new Date(p.fecha_registro).toLocaleDateString("es-MX", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Reciente";

          return {
            id: p.id,
            initials: p.iniciales || "E.A.",
            studentName: `Estudiante ${p.iniciales || ""}`.trim(),
            matricula: p.folio || "TESH",
            career: "TESH Huixquilucan",
            semester: p.semestre ? `${p.semestre}º Semestre` : "Semestre no especificado",
            riskLevel: (p.bloqueado ? "rojo" : "amarillo") as RiskLevel,
            status: (p.bloqueado ? "por_contactar" : "atendido") as CaseStatus,
            summary: `Tamizaje registrado (Folio: ${p.folio || "N/A"}). ${
              p.bloqueado ? "En revisión clínica (bloqueado)." : "Atendido y liberado."
            }`,
            lastCheckIn: dateStr,
            accompanimentSummary: `Paciente evaluado en tamizaje con folio ${p.folio || "N/A"}.`,
            phq9: 0,
            gad7: 0,
            bloqueado: Boolean(p.bloqueado),
          };
        });

        const existingIds = new Set(dbCases.map((c) => c.id));
        const merged = [...dbCases, ...localCases.filter((c) => !existingIds.has(c.id))];
        setCases(merged);
        return;
      }
    } catch (err) {
      console.warn("Aviso al consultar pacientes en Supabase:", err);
    }
    setCases(localCases);
  };

  const handleLiberarPaciente = async (caseId: string) => {
    try {
      await supabase.from("pacientes").update({ bloqueado: false }).eq("id", caseId);

      setCases((prev) =>
        prev.map((c) => (c.id === caseId ? { ...c, status: "atendido", bloqueado: false } : c)),
      );

      updateCaseStatus(caseId, "atendido");
      toast.success("Caso atendido: tamizaje liberado.");
    } catch {
      toast.success("Caso atendido: tamizaje liberado.");
    }
  };

  const refreshAppointments = () => {
    setAppointments(getStoredAppointments());
  };

  useEffect(() => {
    refreshCases();
    refreshAppointments();
    getCanalizaciones({ estado: "pendiente" })
      .then((list) => setPendingCanalizacionesCount(list.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeRiskFilter, selectedCareer, selectedSemester, searchQuery]);

  const handleLogout = () => {
    logout();
    toast.info("Has cerrado sesión como profesional.");
    navigate({ to: "/login", replace: true });
  };

  const handleOpenCaseById = (caseId: string) => {
    const found = cases.find((c) => c.id === caseId);
    if (found) {
      setSelectedCaseForDetail(found);
      setActiveSection("alertas");
    }
  };

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const matchesRisk = activeRiskFilter === null || item.riskLevel === activeRiskFilter;
      const matchesCareer =
        selectedCareer === "all" ||
        (item.career && item.career.toLowerCase().includes(selectedCareer.toLowerCase()));
      const matchesSemester =
        selectedSemester === "all" ||
        (item.semester &&
          (item.semester.toLowerCase() === selectedSemester.toLowerCase() ||
            item.semester.toLowerCase().startsWith(selectedSemester.slice(0, 2).toLowerCase())));

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        query === "" ||
        item.initials.toLowerCase().includes(query) ||
        (item.studentName && item.studentName.toLowerCase().includes(query)) ||
        (item.career && item.career.toLowerCase().includes(query)) ||
        (item.semester && item.semester.toLowerCase().includes(query)) ||
        item.summary.toLowerCase().includes(query);

      return matchesRisk && matchesCareer && matchesSemester && matchesSearch;
    });
  }, [cases, activeRiskFilter, selectedCareer, selectedSemester, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCases = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredCases.slice(start, start + PAGE_SIZE);
  }, [filteredCases, safePage]);

  const handleClearAllFilters = () => {
    setActiveRiskFilter(null);
    setSelectedCareer("all");
    setSelectedSemester("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    activeRiskFilter !== null ||
    selectedCareer !== "all" ||
    selectedSemester !== "all" ||
    searchQuery.trim() !== "";

  const redCount = cases.filter((c) => c.riskLevel === "rojo").length;
  const yellowCount = cases.filter((c) => c.riskLevel === "amarillo").length;
  const greenCount = cases.filter((c) => c.riskLevel === "verde").length;
  const activeAppointmentsCount = useMemo(
    () => appointments.filter((a) => a.status === "confirmada" || a.status === "pendiente").length,
    [appointments],
  );

  const handleOpenCrisisProtocol = () => {
    const targetCase =
      selectedCaseForDetail || cases.find((c) => c.riskLevel === "rojo") || cases[0] || null;
    if (targetCase) {
      setCrisisDialogCase(targetCase);
    } else {
      navigate({ to: "/alerta" });
    }
  };

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Psicología",
      onClick: () => {
        setActiveSection("resumen");
        setSelectedCaseForDetail(null);
      },
    },
    {
      label: SECTION_META[activeSection].breadcrumb,
      onClick: selectedCaseForDetail ? () => setSelectedCaseForDetail(null) : undefined,
    },
    ...(selectedCaseForDetail
      ? [
          {
            label:
              selectedCaseForDetail.matricula?.startsWith("EQ-") ||
              selectedCaseForDetail.matricula?.startsWith("EXP-")
                ? `Expediente ${selectedCaseForDetail.matricula}`
                : `Expediente EQ-${selectedCaseForDetail.matricula?.slice(-4) || selectedCaseForDetail.initials}`,
          },
        ]
      : []),
  ];

  const getFolioForCase = (item: CaseSummary) => {
    if (item.matricula?.startsWith("EQ-")) return item.matricula;
    const digits = (item.matricula || item.id).replace(/[^0-9]/g, "");
    const suffix =
      digits.length >= 4
        ? digits.slice(-4)
        : item.id
            .replace(/[^a-z0-9]/gi, "")
            .toUpperCase()
            .slice(-4)
            .padStart(4, "0");
    return `EQ-${suffix}`;
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] dark:bg-background text-foreground flex flex-col">
      <InstitutionalHeader
        moduleTitle={SECTION_META[activeSection].title}
        breadcrumbs={breadcrumbs}
        onHomeClick={() => {
          setActiveSection("resumen");
          setSelectedCaseForDetail(null);
        }}
        showCrisisButton={true}
        onCrisisClick={handleOpenCrisisProtocol}
        showSidebarToggle={true}
        isSidebarOpen={isMobileSidebarOpen}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        sidebarOffsetClassName="lg:pl-64"
        actions={
          <>
            <AjustesModal
              rol="psicologo"
              trigger={
                <button
                  type="button"
                  aria-label="Abrir panel de configuración y ajustes"
                  title="Ajustes y configuración"
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Settings className="size-[18px]" strokeWidth={1.75} />
                </button>
              }
            />
            <NotificationsCenter
              role="psicologo"
              onSelectCase={handleOpenCaseById}
              onOpenAgenda={() => setActiveSection("agenda")}
              redAlertsCount={redCount}
              triggerClassName="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            />
            <ThemeToggle className="size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none backdrop-blur-none hover:scale-100 hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white" />
          </>
        }
      />

      <div className="flex flex-1 min-w-0">
        <PsychologistSidebar
          activeSection={activeSection}
          onSelectSection={(sec) => {
            setActiveSection(sec);
            setSelectedCaseForDetail(null);
          }}
          redAlertsCount={redCount}
          activeAppointmentsCount={activeAppointmentsCount}
          pendingCanalizacionesCount={pendingCanalizacionesCount}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0 lg:pl-64">
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSection}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {/* SECCIÓN 1: RESUMEN (Default) */}
                {activeSection === "resumen" && (
                  <PsychologistOverview
                    cases={cases}
                    appointments={appointments}
                    onNavigateToSection={(sec) => setActiveSection(sec)}
                    onSelectCase={(caseItem) => setSelectedCaseForDetail(caseItem)}
                    onScheduleCase={(caseItem) => setScheduleDialogCase(caseItem)}
                    onContactCase={(caseItem) => setContactDialogCase(caseItem)}
                  />
                )}

                {/* SECCIÓN 2: ALERTAS */}
                {activeSection === "alertas" && (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-1 border-b border-[#E5DFD3] pb-4">
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1A1A1A]">
                        Casos Clínicos y Triaje de Alertas
                      </h2>
                      <p className="text-xs sm:text-sm text-[#6B6B6B]">
                        Priorización por nivel de riesgo, registro de acompañamiento y liberación de
                        tamizajes.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 border-b border-[#E5DFD3] pb-3">
                      <Button
                        type="button"
                        size="sm"
                        variant={alertasViewMode === "semaforo" ? "default" : "outline"}
                        onClick={() => setAlertasViewMode("semaforo")}
                        className={`h-9 rounded-lg text-xs font-semibold ${
                          alertasViewMode === "semaforo"
                            ? "bg-[#1F4D2C] text-white hover:bg-[#4A7C59]"
                            : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8]"
                        }`}
                      >
                        <Users className="mr-1.5 size-3.5" />
                        Semáforo de Pacientes
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={alertasViewMode === "tarjetas" ? "default" : "outline"}
                        onClick={() => setAlertasViewMode("tarjetas")}
                        className={`h-9 rounded-lg text-xs font-semibold ${
                          alertasViewMode === "tarjetas"
                            ? "bg-[#1F4D2C] text-white hover:bg-[#4A7C59]"
                            : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8]"
                        }`}
                      >
                        <Activity className="mr-1.5 size-3.5" />
                        Vista en Tarjetas
                      </Button>
                    </div>

                    {alertasViewMode === "semaforo" ? (
                      <SemaforoPacientes />
                    ) : (
                      <>
                        {/* Filtros rápidos institucionales */}
                        <section
                          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
                          aria-label="Filtros rápidos por riesgo"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setActiveRiskFilter((prev) => (prev === "rojo" ? null : "rojo"))
                            }
                            className={`rounded-lg border bg-white p-4 text-left flex items-center justify-between transition-colors ${
                              activeRiskFilter === "rojo"
                                ? "border-[#C8102E] ring-2 ring-[#C8102E]/20"
                                : "border-[#E5DFD3] hover:border-[#C8102E]/50"
                            }`}
                          >
                            <div>
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#C8102E]">
                                <ShieldAlert className="size-3.5" />
                                Riesgo Alto
                              </span>
                              <p className="text-2xl font-bold text-[#1A1A1A] mt-1">{redCount}</p>
                              <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                                Atención prioritaria
                              </p>
                            </div>
                            <span className="size-2.5 rounded-full bg-[#C8102E] self-start" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveRiskFilter((prev) =>
                                prev === "amarillo" ? null : "amarillo",
                              )
                            }
                            className={`rounded-lg border bg-white p-4 text-left flex items-center justify-between transition-colors ${
                              activeRiskFilter === "amarillo"
                                ? "border-[#B8860B] ring-2 ring-[#B8860B]/20"
                                : "border-[#E5DFD3] hover:border-[#B8860B]/50"
                            }`}
                          >
                            <div>
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#B8860B]">
                                <Activity className="size-3.5" />
                                Seguimiento
                              </span>
                              <p className="text-2xl font-bold text-[#1A1A1A] mt-1">
                                {yellowCount}
                              </p>
                              <p className="text-[11px] text-[#6B6B6B] mt-0.5">Monitoreo activo</p>
                            </div>
                            <span className="size-2.5 rounded-full bg-[#B8860B] self-start" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveRiskFilter((prev) => (prev === "verde" ? null : "verde"))
                            }
                            className={`rounded-lg border bg-white p-4 text-left flex items-center justify-between transition-colors ${
                              activeRiskFilter === "verde"
                                ? "border-[#1F4D2C] ring-2 ring-[#1F4D2C]/20"
                                : "border-[#E5DFD3] hover:border-[#1F4D2C]/50"
                            }`}
                          >
                            <div>
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1F4D2C]">
                                <UsersRound className="size-3.5" />
                                Estables
                              </span>
                              <p className="text-2xl font-bold text-[#1A1A1A] mt-1">{greenCount}</p>
                              <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                                Sin alertas críticas
                              </p>
                            </div>
                            <span className="size-2.5 rounded-full bg-[#1F4D2C] self-start" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveSection("agenda")}
                            className="rounded-lg border border-[#E5DFD3] bg-white p-4 text-left flex items-center justify-between transition-colors hover:border-[#1F4D2C]/50"
                          >
                            <div>
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1F4D2C]">
                                <Calendar className="size-3.5" />
                                Citas Activas
                              </span>
                              <p className="text-2xl font-bold text-[#1A1A1A] mt-1">
                                {activeAppointmentsCount}
                              </p>
                              <p className="text-[11px] text-[#6B6B6B] mt-0.5">En agenda clínica</p>
                            </div>
                            <CalendarPlus className="size-4 text-[#1F4D2C] self-start" />
                          </button>
                        </section>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                          <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6B6B6B]" />
                            <Input
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Buscar por iniciales, nombre, carrera o síntoma..."
                              className="pl-9 h-9 rounded-lg border-[#E5DFD3] bg-white text-xs focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#6B6B6B] font-semibold">
                              Mostrando {filteredCases.length} de {cases.length} casos
                            </span>
                            {hasActiveFilters && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleClearAllFilters}
                                className="h-8 text-xs text-[#1F4D2C] hover:bg-[#1F4D2C]/10 px-2 font-semibold"
                              >
                                Limpiar filtros
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-xs font-semibold text-[#6B6B6B] mr-1">Riesgo:</span>
                          <button
                            type="button"
                            onClick={() => setActiveRiskFilter(null)}
                            className={chipClass(activeRiskFilter === null)}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveRiskFilter("rojo")}
                            className={chipClass(activeRiskFilter === "rojo")}
                          >
                            Riesgo alto
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveRiskFilter("amarillo")}
                            className={chipClass(activeRiskFilter === "amarillo")}
                          >
                            Seguimiento
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveRiskFilter("verde")}
                            className={chipClass(activeRiskFilter === "verde")}
                          >
                            Estable
                          </button>

                          <div className="h-4 w-px bg-[#E5DFD3] mx-1 hidden sm:block" />

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" className={chipClass(selectedCareer !== "all")}>
                                <span>
                                  {selectedCareer === "all" ? "Carrera: Todas" : selectedCareer}
                                </span>
                                <ChevronDown className="size-3.5 opacity-80" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="w-64 max-h-72 overflow-y-auto"
                            >
                              <DropdownMenuLabel className="text-xs font-bold text-[#6B6B6B]">
                                Carrera TESH
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setSelectedCareer("all")}
                                className={
                                  selectedCareer === "all" ? "font-bold text-[#1F4D2C]" : ""
                                }
                              >
                                Todas las carreras
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {TESH_CAREERS.map((career) => (
                                <DropdownMenuItem
                                  key={career}
                                  onClick={() => setSelectedCareer(career)}
                                  className={
                                    selectedCareer === career ? "font-bold text-[#1F4D2C]" : ""
                                  }
                                >
                                  {career}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={chipClass(selectedSemester !== "all")}
                              >
                                <span>
                                  {selectedSemester === "all"
                                    ? "Semestre: Todos"
                                    : selectedSemester}
                                </span>
                                <ChevronDown className="size-3.5 opacity-80" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="w-52 max-h-72 overflow-y-auto"
                            >
                              <DropdownMenuLabel className="text-xs font-bold text-[#6B6B6B]">
                                Semestre (1º a 9º)
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => setSelectedSemester("all")}
                                className={
                                  selectedSemester === "all" ? "font-bold text-[#1F4D2C]" : ""
                                }
                              >
                                Todos los semestres
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {TESH_SEMESTERS.map((sem) => (
                                <DropdownMenuItem
                                  key={sem}
                                  onClick={() => setSelectedSemester(sem)}
                                  className={
                                    selectedSemester === sem ? "font-bold text-[#1F4D2C]" : ""
                                  }
                                >
                                  {sem}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {filteredCases.length === 0 ? (
                            <div className="col-span-2 p-12 text-center rounded-lg border border-dashed border-[#E5DFD3] bg-white flex flex-col items-center justify-center space-y-3">
                              <p className="text-sm font-semibold text-[#1A1A1A]">
                                No hay casos con estos filtros
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleClearAllFilters}
                                className="rounded-lg border-[#1F4D2C] text-[#1F4D2C] hover:bg-[#1F4D2C]/10 font-medium text-xs"
                              >
                                Limpiar filtros
                              </Button>
                            </div>
                          ) : (
                            paginatedCases.map((item) => {
                              const style = riskStyles[item.riskLevel];
                              const statusInfo = statusLabels[item.status || "por_contactar"];

                              return (
                                <article
                                  key={item.id}
                                  className={`rounded-lg border ${style.border} bg-white p-5 flex flex-col justify-between space-y-4`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                        <div className="grid size-10 shrink-0 place-items-center rounded-full border border-[#E5DFD3] bg-[#F5F1E8] font-bold text-[#1F4D2C] text-sm">
                                          {item.initials}
                                        </div>
                                        <div>
                                          <h3 className="text-sm font-bold text-[#1A1A1A] leading-tight">
                                            {item.studentName || `Estudiante ${item.initials}`}
                                          </h3>
                                          <p className="text-xs text-[#6B6B6B] mt-0.5">
                                            {item.career}{" "}
                                            {item.semester ? `• ${item.semester}` : ""}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        <Badge
                                          variant="outline"
                                          className={`${style.surface} text-xs font-semibold`}
                                        >
                                          <span
                                            className={`mr-1.5 size-2 rounded-full ${style.dot}`}
                                          />
                                          {style.label}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className={`${statusInfo.surface} text-[10px] font-medium`}
                                        >
                                          {statusInfo.label}
                                        </Badge>
                                      </div>
                                    </div>

                                    <p className="mt-3.5 text-xs text-[#1A1A1A] leading-relaxed line-clamp-2 bg-[#F5F1E8]/60 p-2.5 rounded-lg border border-[#E5DFD3]">
                                      {item.summary}
                                    </p>

                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B6B6B]">
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded border border-[#E5DFD3] bg-white text-[11px] font-semibold text-[#1F4D2C]">
                                          PHQ-9: {item.phq9}/27
                                        </span>
                                        <span className="px-2 py-0.5 rounded border border-[#E5DFD3] bg-white text-[11px] font-semibold text-[#1F4D2C]">
                                          GAD-7: {item.gad7}/21
                                        </span>
                                      </div>

                                      <span className="text-[11px] flex items-center gap-1 font-medium text-[#6B6B6B]">
                                        <Clock className="size-3 text-[#1F4D2C]" />
                                        {item.lastCheckIn}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-3 border-t border-[#E5DFD3] flex flex-col gap-2">
                                    <div className="grid grid-cols-3 gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => setScheduleDialogCase(item)}
                                        className="rounded-lg bg-[#1F4D2C] hover:bg-[#4A7C59] text-white text-xs h-9 gap-1 font-semibold"
                                      >
                                        <CalendarPlus className="size-3.5" />
                                        <span className="truncate">Agendar</span>
                                      </Button>

                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setContactDialogCase(item)}
                                        className="rounded-lg border-[#E5DFD3] text-[#1A1A1A] hover:bg-[#F5F1E8] text-xs h-9 gap-1 font-semibold"
                                      >
                                        <PhoneCall className="size-3.5 text-[#1F4D2C]" />
                                        <span className="truncate">Contactar</span>
                                      </Button>

                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setExpedienteFolioModal(getFolioForCase(item))
                                        }
                                        className="rounded-lg text-xs h-9 gap-1 text-[#1F4D2C] hover:bg-[#1F4D2C]/10 font-semibold"
                                      >
                                        <FolderOpen className="size-3.5" />
                                        <span className="truncate">Expediente</span>
                                      </Button>
                                    </div>

                                    {item.riskLevel === "rojo" && item.status !== "atendido" && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => handleLiberarPaciente(item.id)}
                                        className="w-full h-9 rounded-lg bg-[#1F4D2C] hover:bg-[#4A7C59] text-white text-xs font-semibold"
                                      >
                                        Atendido — Liberar
                                      </Button>
                                    )}
                                  </div>
                                </article>
                              );
                            })
                          )}
                        </div>

                        {filteredCases.length > PAGE_SIZE && (
                          <div className="flex items-center justify-between pt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={safePage <= 1}
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              className="rounded-lg border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] disabled:opacity-40 text-xs"
                            >
                              Anterior
                            </Button>
                            <span className="text-xs text-[#6B6B6B] font-medium">
                              Página {safePage} de {totalPages}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={safePage >= totalPages}
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              className="rounded-lg border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] disabled:opacity-40 text-xs"
                            >
                              Siguiente
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* SECCIÓN 2B: CANALIZACIONES */}
                {activeSection === "canalizaciones" && (
                  <CanalizacionesPanel
                    onPendingCountChange={(count) => setPendingCanalizacionesCount(count)}
                  />
                )}

                {/* SECCIÓN 3: EXPEDIENTES */}
                {activeSection === "expedientes" && <ExpedientesPage embedded={true} />}

                {/* SECCIÓN 4: AGENDA DE CITAS */}
                {activeSection === "agenda" && (
                  <div className="space-y-6">
                    <PsychologistAgenda
                      appointments={appointments}
                      onScheduleNew={() => {
                        setScheduleDialogCase(cases[0] || null);
                      }}
                      onAppointmentsChange={() => {
                        refreshAppointments();
                        refreshCases();
                      }}
                    />
                  </div>
                )}

                {/* SECCIÓN 5: BITÁCORA CLÍNICA */}
                {activeSection === "bitacora" && (
                  <div className="space-y-6">
                    <ClinicalNotesFeed onSelectCase={handleOpenCaseById} />
                  </div>
                )}

                {/* SECCIÓN 6: ENCUESTAS */}
                {activeSection === "encuestas" && <ResultadosEncuesta />}

                {/* SECCIÓN 7: RECURSOS */}
                {activeSection === "recursos" && <GestionRecursos />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Diálogo Agendar Sesión */}
      <ScheduleSessionDialog
        caseItem={scheduleDialogCase}
        isOpen={scheduleDialogCase !== null}
        onOpenChange={(open) => {
          if (!open) setScheduleDialogCase(null);
        }}
        onSuccess={() => {
          refreshCases();
          refreshAppointments();
        }}
      />

      {/* Diálogo Registrar Contacto */}
      <ContactPatientDialog
        caseItem={contactDialogCase}
        isOpen={contactDialogCase !== null}
        onOpenChange={(open) => {
          if (!open) setContactDialogCase(null);
        }}
        onSuccess={refreshCases}
      />

      {/* Diálogo Protocolo Crisis */}
      <CrisisProtocolDialog
        caseItem={crisisDialogCase}
        isOpen={crisisDialogCase !== null}
        onOpenChange={(open) => {
          if (!open) setCrisisDialogCase(null);
        }}
        onSuccess={refreshCases}
      />

      {/* Sheet de Detalle */}
      <CaseDetailSheet
        item={selectedCaseForDetail}
        isOpen={selectedCaseForDetail !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCaseForDetail(null);
        }}
        onSchedule={(caseItem) => setScheduleDialogCase(caseItem)}
        onContact={(caseItem) => setContactDialogCase(caseItem)}
        onCrisis={(caseItem) => setCrisisDialogCase(caseItem)}
        onCaseUpdated={refreshCases}
      />

      {/* Modal Expediente Clínico 5 Páginas */}
      <Dialog
        open={Boolean(expedienteFolioModal)}
        onOpenChange={(open) => {
          if (!open) setExpedienteFolioModal(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 sm:p-6">
          <DialogHeader className="sr-only">
            <DialogTitle>Expediente Clínico {expedienteFolioModal}</DialogTitle>
            <DialogDescription>Expediente clínico oficial de 5 páginas</DialogDescription>
          </DialogHeader>
          {expedienteFolioModal && (
            <ExpedienteClinico
              folio={expedienteFolioModal}
              onClose={() => setExpedienteFolioModal(null)}
              onPacienteLiberado={() => {
                refreshCases();
                setExpedienteFolioModal(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
