import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  HeartPulse,
  Library,
  Loader2,
  Lock,
  Play,
  Search,
  Send,
  Settings,
  Stethoscope,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AjustesModal } from "@/components/settings/ajustes-modal";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { DEMO_MODE } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { PsychoResource } from "@/lib/types";
import { actualizarEstadoCitaMedico, getSolicitudesMedico } from "@/features/agenda/agenda-service";
import {
  formatDateToISO,
  formatFechaLegible,
  type EstadoCita,
  type SolicitudCita,
} from "@/features/agenda/types";
import {
  createCanalizacion,
  getCanalizaciones,
  getStudentsDirectoryForMedico,
  type CanalizacionEstado,
  type CanalizacionPrioridad,
  type CanalizacionRecord,
  type TutorStudentItem,
} from "@/features/tutor/tutor-service";
import {
  CANONICAL_RESOURCE_CATEGORIES,
  detectVideoOrientation,
  fetchResourcesAsync,
  getCategoryVisuals,
  getEmbedVideoUrl,
  isDirectVideoFile,
  isExternalEmbedVideo,
} from "@/features/recursos/recursos-service";
import {
  getExpedientesMedicos,
  saveExpedienteMedico,
  type ExpedienteMedicoRecord,
} from "./medico-service";
import { MedicoSidebar, type MedicoNavSection } from "./medico-sidebar";

const SECTION_LABELS: Record<MedicoNavSection, string> = {
  resumen: "Resumen",
  pacientes: "Pacientes",
  agenda: "Agenda",
  canalizaciones: "Canalizaciones",
  expedientes: "Expedientes médicos",
  recursos: "Recursos",
};

const ESTADO_CITA_STYLE: Record<EstadoCita, { label: string; className: string }> = {
  pendiente: {
    label: "Pendiente",
    className:
      "border-[#B8860B]/40 bg-[#FDF6E2] text-[#8C6505] dark:bg-[#2A210B] dark:text-[#F5C77E]",
  },
  confirmada: {
    label: "Confirmada",
    className:
      "border-[#1F4D2C]/35 bg-[#E0F0E8] text-[#1F4D2C] dark:bg-[#1A2618] dark:text-[#8FC9B5]",
  },
  completada: {
    label: "Completada",
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  cancelada: {
    label: "Cancelada",
    className: "border-slate-300 bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  },
  no_asistio: {
    label: "No asistió",
    className:
      "border-[#C8102E]/35 bg-[#FEE2E2] text-[#C8102E] dark:bg-[#3A1118] dark:text-[#FCA5A5]",
  },
};

const CANALIZACION_ESTADO_STYLE: Record<CanalizacionEstado, { label: string; className: string }> =
  {
    pendiente: {
      label: "Pendiente",
      className:
        "border-[#B8860B]/40 bg-[#FDF6E2] text-[#8C6505] dark:bg-[#2A210B] dark:text-[#F5C77E]",
    },
    aceptada: {
      label: "Aceptada",
      className:
        "border-[#1F4D2C]/35 bg-[#E0F0E8] text-[#1F4D2C] dark:bg-[#1A2618] dark:text-[#8FC9B5]",
    },
    completada: {
      label: "Completada",
      className:
        "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    rechazada: {
      label: "Rechazada",
      className:
        "border-[#C8102E]/35 bg-[#FEE2E2] text-[#C8102E] dark:bg-[#3A1118] dark:text-[#FCA5A5]",
    },
  };

interface MedicalPatientSummary {
  estudiante_id: string;
  nombre: string;
  matricula: string;
  carrera: string;
  grupo: string;
  semestre: string;
  ultimaFecha: string;
  ultimoMotivo: string;
  totalCitas: number;
}

export function MedicoDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const useLiveSupabase = !DEMO_MODE && isSupabaseConfigured;
  const medicoId = user?.id || (useLiveSupabase ? "" : "demo-medico-alejandro");
  const medicoNombre =
    user?.name || (useLiveSupabase ? "Médico Universitario" : "Dr. Alejandro Vega");

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<MedicoNavSection>("resumen");

  const [citas, setCitas] = useState<SolicitudCita[]>([]);
  const [canalizaciones, setCanalizaciones] = useState<CanalizacionRecord[]>([]);
  const [expedientes, setExpedientes] = useState<ExpedienteMedicoRecord[]>([]);
  const [studentDirectory, setStudentDirectory] = useState<TutorStudentItem[]>([]);
  const [resources, setResources] = useState<PsychoResource[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de Pacientes & Agenda
  const [patientSearch, setPatientSearch] = useState("");
  const [agendaFilter, setAgendaFilter] = useState<
    "todas" | "activas" | "completadas" | "inactivas"
  >("todas");
  const [agendaSearch, setAgendaSearch] = useState("");
  const [updatingCitaId, setUpdatingCitaId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SolicitudCita | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");

  // Formulario de Canalización al Psicólogo
  const [canStudentId, setCanStudentId] = useState("");
  const [canPrioridad, setCanPrioridad] = useState<CanalizacionPrioridad>("alta");
  const [canMotivo, setCanMotivo] = useState("");
  const [submittingCanalizacion, setSubmittingCanalizacion] = useState(false);

  // Formulario de Expediente Médico Simplificado
  const [expStudentId, setExpStudentId] = useState("");
  const [expFechaConsulta, setExpFechaConsulta] = useState(() => formatDateToISO(new Date()));
  const [expMotivoConsulta, setExpMotivoConsulta] = useState("");
  const [expPresionArterial, setExpPresionArterial] = useState("115/75 mmHg");
  const [expFrecuenciaCardiaca, setExpFrecuenciaCardiaca] = useState("74 lpm");
  const [expTemperatura, setExpTemperatura] = useState("36.5 °C");
  const [expDiagnosticoFisico, setExpDiagnosticoFisico] = useState("");
  const [expIndicaciones, setExpIndicaciones] = useState("");
  const [expCanalizarPsicologia, setExpCanalizarPsicologia] = useState(false);
  const [savingExpediente, setSavingExpediente] = useState(false);

  // Recursos
  const [resourceCategory, setResourceCategory] = useState<string>("Todas");
  const [selectedResource, setSelectedResource] = useState<PsychoResource | null>(null);

  const loadMedicalData = useCallback(async () => {
    if (useLiveSupabase && !medicoId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [citasList, canList, expList, directoryList, resList] = await Promise.all([
        getSolicitudesMedico({ medicoId }),
        getCanalizaciones({ tutorId: medicoId }),
        getExpedientesMedicos(medicoId),
        getStudentsDirectoryForMedico(),
        fetchResourcesAsync(),
      ]);
      setCitas(citasList);
      setCanalizaciones(canList);
      setExpedientes(expList);
      setStudentDirectory(directoryList);
      setResources(resList.filter((r) => r.active !== false));
    } catch (err) {
      console.error("Error al cargar datos médicos:", err);
      toast.error("No se pudieron cargar algunos registros del Servicio Médico.");
    } finally {
      setLoading(false);
    }
  }, [medicoId, useLiveSupabase]);

  useEffect(() => {
    loadMedicalData();
  }, [loadMedicalData]);

  const directoryById = useMemo(() => {
    const map = new Map<string, TutorStudentItem>();
    for (const st of studentDirectory) {
      map.set(st.id, st);
    }
    return map;
  }, [studentDirectory]);

  // Lista única de estudiantes que tienen citas médicas (LFPDPPP: sin datos de tamizaje)
  const medicalPatients = useMemo<MedicalPatientSummary[]>(() => {
    const map = new Map<string, MedicalPatientSummary>();

    for (const cita of citas) {
      const dir = directoryById.get(cita.user_id);
      const existing = map.get(cita.user_id);
      const fechaActual = cita.fecha_cita || "";
      const motivoActual = cita.motivo?.trim() || "Valoración médica general";

      if (!existing) {
        map.set(cita.user_id, {
          estudiante_id: cita.user_id,
          nombre: cita.nombre_estudiante || dir?.nombre || "Estudiante TESH",
          matricula: cita.matricula || dir?.matricula || "Sin matrícula",
          carrera: cita.carrera_estudiante || dir?.carrera || "Carrera TESH",
          grupo: cita.grupo_estudiante || dir?.grupo || "Sin grupo",
          semestre: cita.semestre_estudiante || dir?.semestre || "",
          ultimaFecha: fechaActual,
          ultimoMotivo: motivoActual,
          totalCitas: 1,
        });
      } else {
        existing.totalCitas += 1;
        if (fechaActual >= existing.ultimaFecha) {
          existing.ultimaFecha = fechaActual;
          existing.ultimoMotivo = motivoActual;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [citas, directoryById]);

  // Opciones combinadas para selector de estudiante en Canalizaciones y Expedientes médicos
  const selectableStudents = useMemo<TutorStudentItem[]>(() => {
    const map = new Map<string, TutorStudentItem>();
    for (const mp of medicalPatients) {
      map.set(mp.estudiante_id, {
        id: mp.estudiante_id,
        nombre: mp.nombre,
        matricula: mp.matricula,
        carrera: mp.carrera,
        grupo: mp.grupo,
        semestre: mp.semestre,
      });
    }
    for (const st of studentDirectory) {
      if (!map.has(st.id)) {
        map.set(st.id, st);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [medicalPatients, studentDirectory]);

  const todayIso = formatDateToISO(new Date());

  const activeAppointmentsCount = useMemo(
    () => citas.filter((c) => c.estado === "pendiente" || c.estado === "confirmada").length,
    [citas],
  );

  const todayAppointmentsCount = useMemo(
    () =>
      citas.filter(
        (c) =>
          c.fecha_cita === todayIso &&
          (c.estado === "pendiente" || c.estado === "confirmada" || c.estado === "completada"),
      ).length,
    [citas, todayIso],
  );

  const pendingCanalizacionesCount = useMemo(
    () => canalizaciones.filter((c) => c.estado === "pendiente").length,
    [canalizaciones],
  );

  const upcomingMedicalAppointments = useMemo(
    () => citas.filter((c) => c.estado === "pendiente" || c.estado === "confirmada").slice(0, 5),
    [citas],
  );

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return medicalPatients;
    return medicalPatients.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.matricula.toLowerCase().includes(q) ||
        p.carrera.toLowerCase().includes(q) ||
        p.ultimoMotivo.toLowerCase().includes(q),
    );
  }, [medicalPatients, patientSearch]);

  const filteredAgenda = useMemo(() => {
    const q = agendaSearch.trim().toLowerCase();
    return citas.filter((c) => {
      if (agendaFilter === "activas" && c.estado !== "pendiente" && c.estado !== "confirmada") {
        return false;
      }
      if (agendaFilter === "completadas" && c.estado !== "completada") {
        return false;
      }
      if (agendaFilter === "inactivas" && c.estado !== "cancelada" && c.estado !== "no_asistio") {
        return false;
      }
      if (!q) return true;
      return (
        (c.nombre_estudiante || "").toLowerCase().includes(q) ||
        (c.matricula || "").toLowerCase().includes(q) ||
        (c.motivo || "").toLowerCase().includes(q) ||
        c.folio.toLowerCase().includes(q)
      );
    });
  }, [citas, agendaFilter, agendaSearch]);

  const filteredResources = useMemo(() => {
    if (resourceCategory === "Todas") return resources;
    return resources.filter((r) => r.category === resourceCategory);
  }, [resources, resourceCategory]);

  const handleLogout = () => {
    logout();
    toast.info("Has cerrado sesión.");
    navigate({ to: "/login", replace: true });
  };

  const handleUpdateCitaEstado = async (
    citaId: string,
    nuevoEstado: EstadoCita,
    motivoCancelacion?: string,
  ) => {
    setUpdatingCitaId(citaId);
    try {
      const res = await actualizarEstadoCitaMedico(citaId, nuevoEstado, motivoCancelacion);
      if (!res.ok) {
        toast.error(res.error || "No se pudo actualizar el estado de la cita médica.");
        return;
      }
      const msgMap: Record<EstadoCita, string> = {
        confirmada: "Cita médica confirmada.",
        completada: "Consulta médica marcada como completada.",
        no_asistio: "Inasistencia médica registrada.",
        cancelada: "Cita médica cancelada.",
        pendiente: "Cita actualizada a pendiente.",
      };
      toast.success(msgMap[nuevoEstado]);
      await loadMedicalData();
    } finally {
      setUpdatingCitaId(null);
    }
  };

  const handleOpenCanalizarForStudent = (studentId: string, prefillMotivo?: string) => {
    setCanStudentId(studentId);
    if (prefillMotivo) {
      setCanMotivo(prefillMotivo);
    }
    setActiveSection("canalizaciones");
  };

  const handleOpenExpedienteForStudent = (studentId: string, prefillMotivo?: string) => {
    setExpStudentId(studentId);
    if (prefillMotivo) {
      setExpMotivoConsulta(prefillMotivo);
    }
    setActiveSection("expedientes");
  };

  const handleCreateCanalizacion = async (e: FormEvent) => {
    e.preventDefault();
    const targetStudent = selectableStudents.find((s) => s.id === canStudentId);
    if (!targetStudent) {
      toast.error("Selecciona un estudiante para canalizar al área de Psicología.");
      return;
    }
    if (!canMotivo.trim()) {
      toast.error("Describe el motivo clínico-médico de la canalización.");
      return;
    }

    setSubmittingCanalizacion(true);
    try {
      const res = await createCanalizacion({
        tutor_id: medicoId,
        tutor_nombre: medicoNombre,
        rol_canalizador: "medico",
        estudiante_id: targetStudent.id,
        estudiante_nombre: targetStudent.nombre,
        carrera: targetStudent.carrera,
        grupo: targetStudent.grupo,
        semestre: targetStudent.semestre,
        motivo: canMotivo.trim(),
        prioridad: canPrioridad,
      });

      if (!res.ok) {
        toast.error(res.error || "No fue posible registrar la canalización.");
        return;
      }

      toast.success(
        `Canalización enviada al psicólogo para ${targetStudent.nombre}. El estudiante recibió notificación.`,
      );
      setCanMotivo("");
      await loadMedicalData();
    } finally {
      setSubmittingCanalizacion(false);
    }
  };

  const handleSaveExpediente = async (e: FormEvent) => {
    e.preventDefault();
    const targetStudent = selectableStudents.find((s) => s.id === expStudentId);
    if (!targetStudent) {
      toast.error("Selecciona un estudiante antes de guardar la valoración médica.");
      return;
    }

    setSavingExpediente(true);
    try {
      const res = await saveExpedienteMedico({
        estudiante_id: targetStudent.id,
        estudiante_nombre: targetStudent.nombre,
        matricula: targetStudent.matricula,
        carrera: targetStudent.carrera,
        grupo: targetStudent.grupo,
        medico_id: medicoId,
        medico_nombre: medicoNombre,
        fecha_consulta: expFechaConsulta,
        motivo_consulta: expMotivoConsulta,
        presion_arterial: expPresionArterial,
        frecuencia_cardiaca: expFrecuenciaCardiaca,
        temperatura: expTemperatura,
        diagnostico_fisico: expDiagnosticoFisico,
        indicaciones: expIndicaciones,
        canalizado_psicologia: expCanalizarPsicologia,
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudo guardar el expediente médico.");
        return;
      }

      toast.success("Valoración médica guardada correctamente.");
      const wantsReferral = expCanalizarPsicologia;
      const reasonSnippet = expMotivoConsulta.trim();

      setExpMotivoConsulta("");
      setExpDiagnosticoFisico("");
      setExpIndicaciones("");
      setExpCanalizarPsicologia(false);
      await loadMedicalData();

      if (wantsReferral) {
        handleOpenCanalizarForStudent(
          targetStudent.id,
          `Descartadas causas físicas agudas (${reasonSnippet || "valoración médica"}). Se sugiere acompañamiento psicológico.`,
        );
      }
    } finally {
      setSavingExpediente(false);
    }
  };

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Servicio Médico",
      onClick: () => setActiveSection("resumen"),
    },
    {
      label: SECTION_LABELS[activeSection],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <InstitutionalHeader
        moduleTitle={`Servicio Médico — ${SECTION_LABELS[activeSection]}`}
        breadcrumbs={breadcrumbs}
        onHomeClick={() => setActiveSection("resumen")}
        onBackClick={() => {
          if (activeSection !== "resumen") {
            setActiveSection("resumen");
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
              rol="medico"
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
        <MedicoSidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          activeAppointmentsCount={activeAppointmentsCount}
          pendingCanalizacionesCount={pendingCanalizacionesCount}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="min-w-0 flex-1 lg:pl-64">
          <main className="mx-auto w-full max-w-7xl space-y-6 p-4 pb-16 sm:p-6 lg:p-8">
            {/* Aviso institucional LFPDPPP */}
            <section
              aria-label="Aviso de privacidad médica LFPDPPP"
              className="flex items-start gap-3 rounded-lg border border-[#1F4D2C]/25 bg-white p-3.5 text-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]"
            >
              <Lock className="mt-0.5 size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
              <p className="leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                <strong className="text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Aislamiento clínico LFPDPPP:
                </strong>{" "}
                El Servicio Médico Universitario consulta únicamente identidad académica, motivo de
                consulta médica, agenda médica y expedientes médicos propios. Los puntajes GAD-7,
                PHQ-9, semáforo de riesgo y notas psicológicas son exclusivos de Psicología.
              </p>
            </section>

            {/* 1. RESUMEN */}
            {activeSection === "resumen" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
                      Resumen de Servicio Médico
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                      Panorama operativo de consultas médicas universitarias y canalizaciones a
                      Psicología.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveSection("expedientes")}
                      className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1F4D2C] hover:bg-[#E0F0E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]"
                    >
                      <ClipboardList className="mr-1.5 size-4" />
                      Nueva nota médica
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActiveSection("canalizaciones")}
                      className="h-9 rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
                    >
                      <UserPlus className="mr-1.5 size-4" />
                      Canalizar a psicología
                    </Button>
                  </div>
                </div>

                {/* KPI Grid (4 tarjetas) */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Citas médicas activas
                      </span>
                      <Calendar className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                      {activeAppointmentsCount}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Pendientes y confirmadas
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Citas de hoy
                      </span>
                      <Clock className="size-4 text-[#B8860B]" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-[#B8860B] tabular-nums">
                      {todayAppointmentsCount}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                      Fecha: {todayIso}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Pacientes médicos
                      </span>
                      <Users className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                      {medicalPatients.length}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Con citas en Servicio Médico
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Canalizaciones a Psicología
                      </span>
                      <Stethoscope className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                      {canalizaciones.length}
                    </p>
                    <p className="mt-1 text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                      {pendingCanalizacionesCount} pendientes de aceptación
                    </p>
                  </div>
                </div>

                {/* Dos columnas: Próximas citas médicas + Valoraciones médicas recientes */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <section className="rounded-lg border border-[#E5DFD3] bg-white p-5 lg:col-span-7 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="mb-4 flex items-center justify-between border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
                      <div>
                        <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Próximas citas médicas
                        </h3>
                        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Estudiantes agendados en consultorio médico TESH
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveSection("agenda")}
                        className="h-8 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
                      >
                        Ver agenda
                      </Button>
                    </div>

                    {loading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#6B6B6B]">
                        <Loader2 className="size-4 animate-spin text-[#1F4D2C]" />
                        Cargando citas médicas...
                      </div>
                    ) : upcomingMedicalAppointments.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        No hay citas médicas activas programadas.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingMedicalAppointments.map((cita) => {
                          const badge = ESTADO_CITA_STYLE[cita.estado];
                          return (
                            <div
                              key={cita.id}
                              className="flex flex-col gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                    {cita.nombre_estudiante || "Estudiante TESH"}
                                  </span>
                                  {cita.matricula && (
                                    <span className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                      {cita.matricula}
                                    </span>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${badge.className}`}
                                  >
                                    {badge.label}
                                  </Badge>
                                </div>
                                <p className="truncate text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                  {cita.motivo || "Valoración médica general"}
                                </p>
                              </div>
                              <div className="shrink-0 text-left sm:text-right">
                                <p className="text-xs font-bold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                                  {cita.fecha_cita} · {cita.hora_cita} hrs
                                </p>
                                <p className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                                  {cita.carrera_estudiante || "TESH"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="rounded-lg border border-[#E5DFD3] bg-white p-5 lg:col-span-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="mb-4 flex items-center justify-between border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
                      <div>
                        <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Últimos expedientes médicos
                        </h3>
                        <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Valoraciones físicas recientes
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveSection("expedientes")}
                        className="h-8 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
                      >
                        Abrir
                      </Button>
                    </div>

                    {expedientes.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Aún no hay notas médicas registradas.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {expedientes.slice(0, 4).map((exp) => (
                          <div
                            key={exp.id}
                            className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-3.5 dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                {exp.estudiante_nombre}
                              </span>
                              <span className="text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                {exp.fecha_consulta}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                              {exp.diagnostico_fisico}
                            </p>
                            {exp.canalizado_psicologia && (
                              <p className="mt-1.5 text-[11px] font-semibold text-[#B8860B]">
                                Canalizado a Psicología
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* 2. PACIENTES (Solo estudiantes con citas médicas) */}
            {activeSection === "pacientes" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
                      Pacientes con citas médicas
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                      Estudiantes atendidos o agendados en el Servicio Médico Universitario.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6B6B6B]" />
                    <Input
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder="Buscar por nombre, matrícula o motivo..."
                      className="h-9 rounded-lg border-[#E5DFD3] bg-white pl-9 text-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                    />
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                            Estudiante
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                            Matrícula
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                            Carrera y grupo
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                            Motivo de consulta médica
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                            Última cita
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                        {filteredPatients.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-[#6B6B6B]">
                              No se encontraron estudiantes con citas médicas.
                            </td>
                          </tr>
                        ) : (
                          filteredPatients.map((p) => (
                            <tr
                              key={p.estudiante_id}
                              className="hover:bg-[#F5F1E8]/60 dark:hover:bg-[#0F1A12]/40"
                            >
                              <td className="px-4 py-3 font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                {p.nombre}
                              </td>
                              <td className="px-4 py-3 font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                {p.matricula}
                              </td>
                              <td className="px-4 py-3 text-[#1A1A1A] dark:text-[#F5F1E8]">
                                {p.carrera} · Grupo {p.grupo}
                              </td>
                              <td className="max-w-xs px-4 py-3 text-[#6B6B6B] dark:text-[#A6B5A3]">
                                {p.ultimoMotivo}
                              </td>
                              <td className="px-4 py-3 text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                {p.ultimaFecha}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex flex-wrap justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleOpenExpedienteForStudent(
                                        p.estudiante_id,
                                        p.ultimoMotivo,
                                      )
                                    }
                                    className="h-8 rounded-md border-[#E5DFD3] text-[11px] font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
                                  >
                                    Expediente
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenCanalizarForStudent(
                                        p.estudiante_id,
                                        `Paciente valorado por "${p.ultimoMotivo}". Se sugiere evaluación psicológica complementaria.`,
                                      )
                                    }
                                    className="h-8 rounded-md bg-[#1F4D2C] text-[11px] font-semibold text-white hover:bg-[#4A7C59]"
                                  >
                                    Canalizar
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. AGENDA (Solo citas del Médico) */}
            {activeSection === "agenda" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
                      Agenda de citas médicas
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                      Gestión exclusiva de citas solicitadas con el Servicio Médico Universitario.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#6B6B6B]" />
                    <Input
                      value={agendaSearch}
                      onChange={(e) => setAgendaSearch(e.target.value)}
                      placeholder="Buscar paciente o motivo..."
                      className="h-9 rounded-lg border-[#E5DFD3] bg-white pl-9 text-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                    />
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "todas", label: `Todas (${citas.length})` },
                      { id: "activas", label: `Activas (${activeAppointmentsCount})` },
                      {
                        id: "completadas",
                        label: `Completadas (${citas.filter((c) => c.estado === "completada").length})`,
                      },
                      {
                        id: "inactivas",
                        label: `Canceladas / Inasistencias (${citas.filter((c) => c.estado === "cancelada" || c.estado === "no_asistio").length})`,
                      },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAgendaFilter(tab.id)}
                      className={`h-9 cursor-pointer rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                        agendaFilter === tab.id
                          ? "bg-[#1F4D2C] text-white"
                          : "border border-[#E5DFD3] bg-white text-[#6B6B6B] hover:text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A6B5A3]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {filteredAgenda.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#E5DFD3] bg-white p-10 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <CalendarCheck className="mx-auto mb-2 size-8 text-[#6B6B6B]" />
                    <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      No hay citas médicas en este filtro
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAgenda.map((cita) => {
                      const badge = ESTADO_CITA_STYLE[cita.estado] || ESTADO_CITA_STYLE.pendiente;
                      const isBusy = updatingCitaId === cita.id;
                      const isActive = cita.estado === "pendiente" || cita.estado === "confirmada";

                      return (
                        <article
                          key={cita.id}
                          className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] ${badge.className}`}
                                >
                                  {badge.label}
                                </Badge>
                                <span className="text-xs font-semibold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                                  {formatFechaLegible(cita.fecha_cita)} · {cita.hora_cita} hrs
                                </span>
                                {cita.matricula && (
                                  <span className="text-xs text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                    Matrícula {cita.matricula}
                                  </span>
                                )}
                              </div>

                              <div>
                                <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                  {cita.nombre_estudiante || "Estudiante TESH"}
                                </h3>
                                <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                  {cita.carrera_estudiante || "Carrera TESH"}
                                  {cita.grupo_estudiante ? ` · Grupo ${cita.grupo_estudiante}` : ""}
                                </p>
                              </div>

                              {cita.motivo && (
                                <div className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8]/70 px-3 py-2 text-xs text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
                                  <span className="font-semibold">Motivo de consulta médica: </span>
                                  {cita.motivo}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {cita.estado === "pendiente" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() => handleUpdateCitaEstado(cita.id, "confirmada")}
                                  className="h-9 rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
                                >
                                  <CheckCircle2 className="mr-1.5 size-3.5" />
                                  Confirmar
                                </Button>
                              )}

                              {isActive && (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleUpdateCitaEstado(cita.id, "completada")}
                                    className="h-9 rounded-lg border-emerald-300 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300"
                                  >
                                    Completada
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => handleUpdateCitaEstado(cita.id, "no_asistio")}
                                    className="h-9 rounded-lg border-[#B8860B]/40 text-xs font-semibold text-[#B8860B] hover:bg-[#FDF6E2]"
                                  >
                                    No asistió
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setCancelTarget(cita);
                                      setCancelMotivo("");
                                    }}
                                    className="h-9 rounded-lg border-[#C8102E]/40 text-xs font-semibold text-[#C8102E] hover:bg-[#FEE2E2]"
                                  >
                                    <XCircle className="mr-1 size-3.5" />
                                    Cancelar
                                  </Button>
                                </>
                              )}

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleOpenExpedienteForStudent(
                                    cita.user_id,
                                    cita.motivo || undefined,
                                  )
                                }
                                className="h-9 rounded-lg text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
                              >
                                Nota médica
                              </Button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 4. CANALIZACIONES (Médico -> Psicólogo) */}
            {activeSection === "canalizaciones" && (
              <div className="space-y-6">
                <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                  <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
                    Canalizaciones al Área de Psicología
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                    Cuando se descartan causas físicas o se identifica necesidad de apoyo emocional,
                    refiere al estudiante directamente al psicólogo institucional.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Formulario de envío */}
                  <form
                    onSubmit={handleCreateCanalizacion}
                    className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-5 lg:col-span-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                  >
                    <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      Nueva canalización médica → psicología
                    </h3>

                    <div className="space-y-1.5">
                      <Label htmlFor="can-student" className="text-xs font-semibold">
                        Estudiante
                      </Label>
                      <Select value={canStudentId} onValueChange={setCanStudentId}>
                        <SelectTrigger
                          id="can-student"
                          className="h-10 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                        >
                          <SelectValue placeholder="Selecciona un estudiante..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                          {selectableStudents.map((st) => (
                            <SelectItem key={st.id} value={st.id} className="text-xs">
                              {st.nombre} ({st.matricula}) · {st.carrera}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="can-prioridad" className="text-xs font-semibold">
                        Prioridad de atención
                      </Label>
                      <Select
                        value={canPrioridad}
                        onValueChange={(v) => setCanPrioridad(v as CanalizacionPrioridad)}
                      >
                        <SelectTrigger
                          id="can-prioridad"
                          className="h-10 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                          <SelectItem value="normal" className="text-xs">
                            Normal
                          </SelectItem>
                          <SelectItem value="alta" className="text-xs">
                            Alta
                          </SelectItem>
                          <SelectItem value="urgente" className="text-xs">
                            Urgente
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="can-motivo" className="text-xs font-semibold">
                        Resumen médico y motivo de canalización
                      </Label>
                      <Textarea
                        id="can-motivo"
                        rows={4}
                        value={canMotivo}
                        onChange={(e) => setCanMotivo(e.target.value)}
                        placeholder="Ej. Valoración física normal; persisten insomnio y somatización tensional. Se canaliza a Psicología para seguimiento emocional."
                        className="resize-none rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingCanalizacion}
                      className="h-10 w-full rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
                    >
                      {submittingCanalizacion ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <Send className="mr-1.5 size-4" />
                      )}
                      Enviar canalización al psicólogo
                    </Button>
                  </form>

                  {/* Historial de canalizaciones médicas */}
                  <section className="rounded-lg border border-[#E5DFD3] bg-white p-5 lg:col-span-7 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <h3 className="mb-4 border-b border-[#E5DFD3] pb-3 text-sm font-bold text-[#1A1A1A] dark:border-[#2D3F2A] dark:text-[#F5F1E8]">
                      Canalizaciones enviadas ({canalizaciones.length})
                    </h3>

                    {canalizaciones.length === 0 ? (
                      <p className="py-10 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        No has enviado canalizaciones al área de Psicología todavía.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {canalizaciones.map((item) => {
                          const est =
                            CANALIZACION_ESTADO_STYLE[item.estado] ||
                            CANALIZACION_ESTADO_STYLE.pendiente;
                          return (
                            <article
                              key={item.id}
                              className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                    {item.estudiante_nombre || "Estudiante TESH"}
                                  </p>
                                  <p className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                                    {item.carrera || "Carrera TESH"}
                                    {item.grupo ? ` · Grupo ${item.grupo}` : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className="border-[#E5DFD3] text-[10px] capitalize dark:border-[#2D3F2A]"
                                  >
                                    Prioridad {item.prioridad}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${est.className}`}
                                  >
                                    {est.label}
                                  </Badge>
                                </div>
                              </div>
                              <p className="mt-2 text-xs leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                                {item.motivo}
                              </p>
                              {item.estado === "rechazada" && item.motivo_rechazo && (
                                <p className="mt-2 text-[11px] font-medium text-[#C8102E]">
                                  Observación de Psicología: {item.motivo_rechazo}
                                </p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* 5. EXPEDIENTES MÉDICOS (Simplificado, aislado del expediente psicológico) */}
            {activeSection === "expedientes" && (
              <div className="space-y-6">
                <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                  <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
                    Expedientes médicos simplificados
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                    Registro exclusivo de valoración física y signos vitales. No incluye puntajes ni
                    notas psicológicas.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Formulario de nota médica */}
                  <form
                    onSubmit={handleSaveExpediente}
                    className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-5 lg:col-span-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                  >
                    <h3 className="flex items-center gap-2 text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      <HeartPulse className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      Registrar valoración médica
                    </h3>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="exp-student" className="text-xs font-semibold">
                          Estudiante
                        </Label>
                        <Select value={expStudentId} onValueChange={setExpStudentId}>
                          <SelectTrigger
                            id="exp-student"
                            className="h-10 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                          >
                            <SelectValue placeholder="Selecciona un estudiante..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                            {selectableStudents.map((st) => (
                              <SelectItem key={st.id} value={st.id} className="text-xs">
                                {st.nombre} ({st.matricula})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="exp-fecha" className="text-xs font-semibold">
                          Fecha de consulta
                        </Label>
                        <Input
                          id="exp-fecha"
                          type="date"
                          value={expFechaConsulta}
                          onChange={(e) => setExpFechaConsulta(e.target.value)}
                          className="h-10 rounded-lg border-[#E5DFD3] bg-white text-xs tabular-nums dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="exp-pa" className="text-xs font-semibold">
                          Presión arterial
                        </Label>
                        <Input
                          id="exp-pa"
                          value={expPresionArterial}
                          onChange={(e) => setExpPresionArterial(e.target.value)}
                          placeholder="115/75 mmHg"
                          className="h-10 rounded-lg border-[#E5DFD3] bg-white text-xs tabular-nums dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="exp-fc" className="text-xs font-semibold">
                          Frecuencia cardíaca
                        </Label>
                        <Input
                          id="exp-fc"
                          value={expFrecuenciaCardiaca}
                          onChange={(e) => setExpFrecuenciaCardiaca(e.target.value)}
                          placeholder="74 lpm"
                          className="h-10 rounded-lg border-[#E5DFD3] bg-white text-xs tabular-nums dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="exp-temp" className="text-xs font-semibold">
                          Temperatura
                        </Label>
                        <Input
                          id="exp-temp"
                          value={expTemperatura}
                          onChange={(e) => setExpTemperatura(e.target.value)}
                          placeholder="36.5 °C"
                          className="h-10 rounded-lg border-[#E5DFD3] bg-white text-xs tabular-nums dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="exp-motivo" className="text-xs font-semibold">
                        Motivo de consulta y síntomas físicos
                      </Label>
                      <Textarea
                        id="exp-motivo"
                        rows={2}
                        value={expMotivoConsulta}
                        onChange={(e) => setExpMotivoConsulta(e.target.value)}
                        placeholder="Ej. Cefalea matutina, insomnio, fatiga o molestias gastrointestinales..."
                        className="resize-none rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="exp-diag" className="text-xs font-semibold">
                        Valoración / diagnóstico físico
                      </Label>
                      <Textarea
                        id="exp-diag"
                        rows={3}
                        value={expDiagnosticoFisico}
                        onChange={(e) => setExpDiagnosticoFisico(e.target.value)}
                        placeholder="Hallazgos de exploración física y descarte de causas orgánicas..."
                        className="resize-none rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="exp-ind" className="text-xs font-semibold">
                        Indicaciones médicas y plan
                      </Label>
                      <Textarea
                        id="exp-ind"
                        rows={2}
                        value={expIndicaciones}
                        onChange={(e) => setExpIndicaciones(e.target.value)}
                        placeholder="Medidas de higiene de sueño, hidratación o seguimiento médico..."
                        className="resize-none rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                      />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/70 p-3 text-xs font-medium dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                      <input
                        type="checkbox"
                        checked={expCanalizarPsicologia}
                        onChange={(e) => setExpCanalizarPsicologia(e.target.checked)}
                        className="size-4 accent-[#1F4D2C]"
                      />
                      <span>
                        Al guardar, abrir canalización al psicólogo para seguimiento emocional
                      </span>
                    </label>

                    <Button
                      type="submit"
                      disabled={savingExpediente}
                      className="h-10 w-full rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
                    >
                      {savingExpediente ? (
                        <Loader2 className="mr-1.5 size-4 animate-spin" />
                      ) : (
                        <Activity className="mr-1.5 size-4" />
                      )}
                      {expCanalizarPsicologia
                        ? "Guardar y canalizar a psicología"
                        : "Guardar valoración médica"}
                    </Button>
                  </form>

                  {/* Historial de expedientes médicos */}
                  <section className="rounded-lg border border-[#E5DFD3] bg-white p-5 lg:col-span-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <h3 className="mb-4 border-b border-[#E5DFD3] pb-3 text-sm font-bold text-[#1A1A1A] dark:border-[#2D3F2A] dark:text-[#F5F1E8]">
                      Historial de valoraciones médicas ({expedientes.length})
                    </h3>

                    {expedientes.length === 0 ? (
                      <p className="py-10 text-center text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        No hay expedientes médicos registrados todavía.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {expedientes.map((exp) => (
                          <article
                            key={exp.id}
                            className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                  {exp.estudiante_nombre}
                                </p>
                                <p className="text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                                  {exp.matricula} · {exp.carrera} · Grupo {exp.grupo}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-[#1F4D2C] tabular-nums dark:text-[#8FC9B5]">
                                {exp.fecha_consulta}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-3 text-[11px] text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                              {exp.presion_arterial && <span>TA: {exp.presion_arterial}</span>}
                              {exp.frecuencia_cardiaca && (
                                <span>FC: {exp.frecuencia_cardiaca}</span>
                              )}
                              {exp.temperatura && <span>Temp: {exp.temperatura}</span>}
                            </div>

                            <p className="text-xs text-[#1A1A1A] dark:text-[#F5F1E8]">
                              <strong className="font-semibold">Motivo:</strong>{" "}
                              {exp.motivo_consulta}
                            </p>
                            <p className="text-xs text-[#1A1A1A] dark:text-[#F5F1E8]">
                              <strong className="font-semibold">Valoración física:</strong>{" "}
                              {exp.diagnostico_fisico}
                            </p>
                            <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                              <strong className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                Indicaciones:
                              </strong>{" "}
                              {exp.indicaciones}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                                Médico: {exp.medico_nombre}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleOpenCanalizarForStudent(
                                    exp.estudiante_id,
                                    `Valoración médica (${exp.fecha_consulta}): ${exp.diagnostico_fisico}. Se canaliza a Psicología.`,
                                  )
                                }
                                className="h-7 px-2 text-[11px] font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
                              >
                                Canalizar a Psicología
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* 6. RECURSOS */}
            {activeSection === "recursos" && (
              <div className="space-y-6">
                <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                  <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
                    Recursos de salud y autocuidado TESH
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                    Guías de higiene del sueño, relajación muscular y manejo del estrés para
                    compartir en consulta médica.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {["Todas", ...CANONICAL_RESOURCE_CATEGORIES].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setResourceCategory(cat)}
                      className={`h-8 cursor-pointer rounded-full px-3.5 text-xs font-semibold transition-colors ${
                        resourceCategory === cat
                          ? "bg-[#1F4D2C] text-white"
                          : "border border-[#E5DFD3] bg-white text-[#6B6B6B] hover:text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A6B5A3]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredResources.map((rec) => {
                    const visuals = getCategoryVisuals(rec.category);
                    const hasVideo = rec.format === "video" || Boolean(rec.videoUrl);
                    return (
                      <article
                        key={rec.id}
                        className="flex flex-col justify-between rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${visuals.softBgClass}`}
                            >
                              {visuals.label}
                            </span>
                            <span className="text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                              {rec.readTime}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {rec.title}
                          </h3>
                          <p className="text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {rec.shortDescription}
                          </p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-[#E5DFD3] pt-3 dark:border-[#2D3F2A]">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {hasVideo ? (
                              <Play className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                            ) : (
                              <BookOpen className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                            )}
                            {hasVideo ? "Video guiado" : "Lectura práctica"}
                          </span>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedResource(rec)}
                            className="h-8 rounded-md border-[#E5DFD3] text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
                          >
                            <Library className="mr-1.5 size-3.5" />
                            Abrir recurso
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Dialog para cancelar cita médica */}
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Cancelar cita médica</DialogTitle>
            <DialogDescription className="text-xs">
              Indica el motivo de cancelación para la cita de{" "}
              {cancelTarget?.nombre_estudiante || "este estudiante"} ({cancelTarget?.fecha_cita} ·{" "}
              {cancelTarget?.hora_cita} hrs).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="motivo-cancel-med" className="text-xs font-semibold">
              Motivo (opcional)
            </Label>
            <Textarea
              id="motivo-cancel-med"
              rows={3}
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder="Ej. Reprogramación por jornada médica externa..."
              className="rounded-lg text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelTarget(null)}
              className="rounded-lg text-xs"
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (!cancelTarget) return;
                const target = cancelTarget;
                setCancelTarget(null);
                await handleUpdateCitaEstado(target.id, "cancelada", cancelMotivo);
              }}
              className="rounded-lg text-xs font-semibold"
            >
              Confirmar cancelación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver recurso */}
      <Dialog
        open={selectedResource !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedResource(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-lg sm:max-w-2xl">
          {selectedResource && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold">{selectedResource.title}</DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedResource.category} · {selectedResource.readTime}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {selectedResource.videoUrl && isExternalEmbedVideo(selectedResource.videoUrl) && (
                  <div
                    className={
                      detectVideoOrientation(
                        selectedResource.videoUrl,
                        selectedResource.videoOrientation,
                      ) === "vertical"
                        ? "mx-auto aspect-[9/16] max-w-xs overflow-hidden rounded-lg border border-[#E5DFD3]"
                        : "aspect-video w-full overflow-hidden rounded-lg border border-[#E5DFD3]"
                    }
                  >
                    <iframe
                      src={getEmbedVideoUrl(selectedResource.videoUrl) || selectedResource.videoUrl}
                      title={selectedResource.videoTitle || selectedResource.title}
                      className="size-full"
                      allowFullScreen
                    />
                  </div>
                )}

                {selectedResource.videoUrl && isDirectVideoFile(selectedResource.videoUrl) && (
                  <video
                    controls
                    src={selectedResource.videoUrl}
                    className="w-full rounded-lg border border-[#E5DFD3]"
                  />
                )}

                <div className="space-y-3 text-xs leading-relaxed text-[#1A1A1A] sm:text-sm dark:text-[#F5F1E8]">
                  {selectedResource.content.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>

                {selectedResource.keyTakeaway && (
                  <div className="rounded-lg border border-[#1F4D2C]/25 bg-[#E0F0E8] p-3 text-xs font-medium text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]">
                    <strong>Idea clave:</strong> {selectedResource.keyTakeaway}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => setSelectedResource(null)}
                  className="rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
