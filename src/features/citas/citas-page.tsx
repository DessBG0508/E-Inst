import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AlertCircle, Calendar, CheckCircle2, ClipboardList, Settings } from "lucide-react";
import { toast } from "sonner";
import { StudentTopBar } from "@/components/layout/student-top-bar";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { useAuth } from "@/lib/auth-context";
import { DEMO_MODE } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { clearLegacyUnscopedScreeningData, getStoredUserFolio } from "@/lib/screening-storage";
import { CalendarioCitas } from "@/features/agenda/CalendarioCitas";
import { FormularioSolicitud } from "@/features/agenda/FormularioSolicitud";
import { EstadoCitaList } from "@/features/agenda/EstadoCita";
import {
  cancelarCitaEstudiante,
  crearSolicitudCita,
  getSolicitudesEstudiante,
} from "@/features/agenda/agenda-service";
import type {
  ProfesionalDisponible,
  SolicitudCita,
  TipoProfesional,
} from "@/features/agenda/types";
import {
  getStudentPendingCanalizaciones,
  type CanalizacionRecord,
} from "@/features/tutor/tutor-service";

type CitasStep = "calendario" | "solicitud" | "estado";

export function CitasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/citas" });

  const [tipoProfesional, setTipoProfesional] = useState<TipoProfesional>(() =>
    search.tipo === "medico" ? "medico" : "psicologo",
  );
  const [step, setStep] = useState<CitasStep>("calendario");
  const [selectedFecha, setSelectedFecha] = useState<string>("");
  const [selectedHora, setSelectedHora] = useState<string>("");
  const [assignedPsicologo, setAssignedPsicologo] = useState<ProfesionalDisponible | null>(null);

  const [citas, setCitas] = useState<SolicitudCita[]>([]);
  const [isLoadingCitas, setIsLoadingCitas] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [pendingCanalizaciones, setPendingCanalizaciones] = useState<CanalizacionRecord[]>([]);

  const useLiveSupabase = !DEMO_MODE && isSupabaseConfigured;
  const studentUserId = user?.id || (useLiveSupabase ? "" : "demo-student-dess");
  const resolveStudentFolio = useCallback(() => {
    clearLegacyUnscopedScreeningData();
    return (
      getStoredUserFolio(user?.id, user?.email) ||
      user?.matricula ||
      (useLiveSupabase ? "" : "EQ-9374")
    );
  }, [useLiveSupabase, user?.email, user?.id, user?.matricula]);

  const loadCitas = useCallback(async () => {
    if (!studentUserId) {
      setCitas([]);
      setIsLoadingCitas(false);
      return;
    }
    setIsLoadingCitas(true);
    try {
      const folio = resolveStudentFolio();
      const list = await getSolicitudesEstudiante(studentUserId, folio);
      setCitas(list);
    } catch {
      toast.error("No fue posible consultar tus citas en el servidor.");
      setCitas([]);
    } finally {
      setIsLoadingCitas(false);
    }
  }, [resolveStudentFolio, studentUserId]);

  useEffect(() => {
    loadCitas();
  }, [loadCitas]);

  useEffect(() => {
    if (!studentUserId) {
      setPendingCanalizaciones([]);
      return;
    }
    let active = true;
    getStudentPendingCanalizaciones(studentUserId)
      .then((list) => {
        if (active) setPendingCanalizaciones(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [studentUserId]);

  useEffect(() => {
    if (search.tipo === "medico" || search.tipo === "psicologo") {
      setTipoProfesional(search.tipo);
      setAssignedPsicologo(null);
    }
  }, [search.tipo]);

  const hasActiveAppointment = citas.some(
    (c) =>
      (c.tipo_profesional || "psicologo") === tipoProfesional &&
      (c.estado === "pendiente" || c.estado === "confirmada"),
  );

  const handleChangeTipoProfesional = (nuevoTipo: TipoProfesional) => {
    setTipoProfesional(nuevoTipo);
    setSelectedFecha("");
    setSelectedHora("");
    setAssignedPsicologo(null);
  };

  const handleSelectSlot = (fecha: string, hora: string, profesional: ProfesionalDisponible) => {
    setSelectedFecha(fecha);
    setSelectedHora(hora);
    setAssignedPsicologo(profesional);
    setStep("solicitud");
  };

  const handleConfirmSolicitud = async (motivo: string) => {
    if (!selectedFecha || !selectedHora || !assignedPsicologo) return;
    setIsSubmitting(true);
    try {
      const activeFolio = resolveStudentFolio();
      const iniciales = user?.name
        ? user.name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join(".") + "."
        : "E.T.";

      const res = await crearSolicitudCita({
        folio: activeFolio,
        user_id: studentUserId,
        psicologo_id: assignedPsicologo.id,
        nombre_psicologo: assignedPsicologo.nombre,
        tipo_profesional: tipoProfesional,
        iniciales_estudiante: iniciales,
        carrera_estudiante: user?.carrera || "Ing. en Sistemas Computacionales",
        semestre_estudiante: user?.semestre ? `${user.semestre}º Semestre` : "5º Semestre",
        grupo_estudiante: user?.grupo || undefined,
        matricula: user?.matricula || undefined,
        email: user?.email,
        nombre_estudiante: user?.name,
        fecha_cita: selectedFecha,
        hora_cita: selectedHora,
        modalidad: "presencial",
        estado: "pendiente",
        motivo: motivo || undefined,
      });

      if (!res.ok || !res.cita) {
        toast.error(res.error || "No fue posible registrar la cita.");
        return;
      }

      toast.success("Cita solicitada correctamente. Recibirás confirmación por correo.");
      await loadCitas();
      setStep("estado");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelarCita = async (citaId: string, fechaCita: string, horaCita: string) => {
    setCancelingId(citaId);
    try {
      const res = await cancelarCitaEstudiante(citaId, fechaCita, horaCita);
      if (!res.ok) {
        toast.error(res.error || "No es posible cancelar la cita.");
        return;
      }
      toast.info("Tu cita ha sido cancelada.");
      await loadCitas();
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <StudentTopBar
        title="Agendar cita"
        backTo={step === "calendario" ? "/" : undefined}
        onBack={step === "calendario" ? () => navigate({ to: "/" }) : () => setStep("calendario")}
        rightActions={
          <AjustesModal
            rol="estudiante"
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
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 pb-16 sm:p-6 lg:p-8">
        {/* Encabezado de pantalla + Navegación de 3 pantallas */}
        <section className="flex flex-col gap-4 border-b border-[#E5DFD3] pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-[#2D3F2A]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1F4D2C] sm:text-3xl dark:text-[#8FC9B5]">
              Agendar cita
            </h1>
            <p className="mt-1 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
              Atención psicológica presencial en el Tecnológico de Estudios Superiores de
              Huixquilucan.
            </p>
          </div>

          {/* Stepper interactivo: Calendario -> Solicitud -> Estado */}
          <nav
            aria-label="Flujo de agendamiento"
            className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white p-1 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
          >
            <button
              type="button"
              onClick={() => setStep("calendario")}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
                step === "calendario"
                  ? "bg-[#1F4D2C] text-white"
                  : "text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12]"
              }`}
            >
              <Calendar className="size-3.5" />
              <span>1. Calendario</span>
            </button>

            <button
              type="button"
              disabled={!selectedFecha || !selectedHora || !assignedPsicologo}
              onClick={() => setStep("solicitud")}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                step === "solicitud"
                  ? "bg-[#1F4D2C] text-white"
                  : "cursor-pointer text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12]"
              }`}
            >
              <CheckCircle2 className="size-3.5" />
              <span>2. Solicitud</span>
            </button>

            <button
              type="button"
              onClick={() => setStep("estado")}
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
                step === "estado"
                  ? "bg-[#1F4D2C] text-white"
                  : "text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12]"
              }`}
            >
              <ClipboardList className="size-3.5" />
              <span>3. Mis citas ({citas.length})</span>
            </button>
          </nav>
        </section>

        {/* Aviso si tiene canalización pendiente */}
        {pendingCanalizaciones.length > 0 && (
          <section
            aria-label="Canalización pendiente"
            className="flex items-start gap-3 rounded-lg border border-[#B8860B]/30 bg-white p-4 dark:border-[#B8860B]/40 dark:bg-[#1A2618]"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#B8860B]" strokeWidth={1.75} />
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#B8860B]">
                {pendingCanalizaciones[0].rol_canalizador === "medico"
                  ? "Canalización del Servicio Médico Universitario activa"
                  : "Canalización de tutoría académica activa"}
              </p>
              <p className="text-xs leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                {pendingCanalizaciones[0].rol_canalizador === "medico"
                  ? "El médico universitario te ha referido al psicólogo. Agenda tu cita con Psicología seleccionando el horario disponible."
                  : "Tu tutor te ha referido al psicólogo. Agenda tu cita seleccionando el horario disponible."}
              </p>
              <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                Motivo:{" "}
                <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  {pendingCanalizaciones[0].motivo}
                </span>{" "}
                · Prioridad:{" "}
                <span className="font-bold capitalize text-[#B8860B]">
                  {pendingCanalizaciones[0].prioridad}
                </span>
              </p>
            </div>
          </section>
        )}

        {/* PANTALLA 1 — CALENDARIO */}
        {step === "calendario" && (
          <CalendarioCitas
            fechaPrevia={selectedFecha}
            tipoProfesional={tipoProfesional}
            onChangeTipoProfesional={handleChangeTipoProfesional}
            onSelectSlot={handleSelectSlot}
            hasActiveAppointment={hasActiveAppointment}
            onGoToMisCitas={() => setStep("estado")}
          />
        )}

        {/* PANTALLA 2 — SOLICITUD */}
        {step === "solicitud" && assignedPsicologo && (
          <FormularioSolicitud
            fechaCita={selectedFecha}
            horaCita={selectedHora}
            psicologoAsignado={assignedPsicologo}
            tipoProfesional={tipoProfesional}
            onSubmit={handleConfirmSolicitud}
            onCancel={() => setStep("calendario")}
            isSubmitting={isSubmitting}
          />
        )}

        {/* PANTALLA 3 — ESTADO (MIS CITAS) */}
        {step === "estado" && (
          <>
            {isLoadingCitas ? (
              <div className="rounded-lg border border-[#E5DFD3] bg-white p-8 text-center text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                Cargando historial de citas...
              </div>
            ) : (
              <EstadoCitaList
                citas={citas}
                onCancelarCita={handleCancelarCita}
                onNuevaSolicitud={() => setStep("calendario")}
                isCancelingId={cancelingId}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
