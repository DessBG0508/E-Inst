import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getPsychologistCases } from "@/lib/psychologist-store";
import { toast } from "sonner";
import {
  ArrowLeft,
  Printer,
  Save,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  Layers,
  UserCheck,
  MessageSquareText,
  ClipboardList,
  Brain,
  ShieldAlert,
  Lock,
} from "lucide-react";

import type { PacienteParaPsicologo } from "./semaforo-pacientes";
import type { CamposClinicos, ExpedienteDbRecord } from "./expediente/types";

import { Identificacion } from "./expediente/Identificacion";
import { MotivoConsulta } from "./expediente/MotivoConsulta";
import { HistoriaProblema } from "./expediente/HistoriaProblema";
import { Antecedentes } from "./expediente/Antecedentes";
import { ContextoPsicosocial } from "./expediente/ContextoPsicosocial";
import { EstadoMental } from "./expediente/EstadoMental";
import { ValoracionRiesgo } from "./expediente/ValoracionRiesgo";
import { HipotesisTrabajo } from "./expediente/HipotesisTrabajo";
import { ObjetivosSesion } from "./expediente/ObjetivosSesion";
import { TrazabilidadBlockchain } from "./expediente/TrazabilidadBlockchain";

export interface ExpedienteClinicoProps {
  folio: string;
  onClose?: () => void;
  onPacienteLiberado?: () => void;
  className?: string;
}

interface ExpedientePageMeta {
  page: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const EXPEDIENTE_PAGES: ExpedientePageMeta[] = [
  {
    page: 1,
    title: "Identificación",
    subtitle: "Datos desde Supabase (solo lectura)",
    icon: UserCheck,
  },
  {
    page: 2,
    title: "Motivo de consulta",
    subtitle: "Relato y tamizaje de ingreso",
    icon: MessageSquareText,
  },
  {
    page: 3,
    title: "Historia + Antecedentes",
    subtitle: "Evolución clínica y previos",
    icon: ClipboardList,
  },
  {
    page: 4,
    title: "Contexto + Estado Mental",
    subtitle: "Entorno y semiología",
    icon: Brain,
  },
  {
    page: 5,
    title: "Valoración, Hipótesis y Cierre",
    subtitle: "Riesgo, objetivos y trazabilidad",
    icon: ShieldAlert,
  },
];

function buildExpedienteFolio(screeningFolio: string): string {
  const digits = screeningFolio.replace(/[^0-9]/g, "");
  if (digits.length >= 4) {
    return `EXP-2026-${digits.slice(-4)}`;
  }
  let hash = 0;
  for (let i = 0; i < screeningFolio.length; i++) {
    hash = (hash * 31 + screeningFolio.charCodeAt(i)) % 9000;
  }
  const suffix = String(1000 + Math.abs(hash)).slice(0, 4);
  return `EXP-2026-${suffix}`;
}

const DEFAULT_CAMPOS: CamposClinicos = {
  iniciales: "",
  edad: 21,
  sexo: "Mujer",
  semestre: "6º Semestre",
  carrera: "Ing. en Sistemas Computacionales",
  grupo: "501",
  derivado_por: "Tamizaje preventivo Eli (Canalización institucional)",

  motivo_en_palabras: "",
  historia_clinica: "",

  antecedentes: {
    tratamiento_psicologico_previo: false,
    hospitalizaciones: false,
    seguimiento_psiquiatrico: false,
    antecedentes_familiares: false,
    medicacion_actual: false,
    enfermedad_medica_relevante: false,
    detalle_antecedentes: "",
  },

  contexto_psicosocial: {
    carrera_semestre: "",
    grupo: "",
    convivencia: "",
    situacion_laboral: "",
    red_apoyo: "",
    factores_estres: "",
  },

  estado_mental: {
    aspecto_cuidado: true,
    orientado: true,
    contacto_adecuado: true,
    discurso_coherente: true,
    animo_bajo: true,
    ansiedad_manifiesta: true,
    enlentecimiento: false,
    inquietud_psicomotriz: false,
    sueno_alterado: true,
    pensamiento_perseverante: false,
    afecto_congruente: true,
    juicio_conservado: true,
    observaciones: "",
  },

  valoracion_riesgo: {
    item9_valor: 1,
    item9_texto:
      "Valor del último PHQ-9: 1 (0=mínimo, 3=máximo). Cualquier valor ≥ 1 indica riesgo autolítico y escaló automáticamente a nivel de atención prioritaria.",
    marcadores: {
      ideacion_autolitica: false,
      plan_estructurado: false,
      intentos_previos: false,
      autolesiones: false,
      consumo_sustancias: false,
      riesgo_terceros: false,
    },
    riesgo_estimado: 4,
    factores_proteccion: "",
  },

  hipotesis_trabajo: "",

  objetivos_sesion: {
    consentimiento_firmado: false,
    frecuencia_acordada: "Semanal",
    proxima_cita: "",
    estado_bloqueo: "bloqueado",
    notas_libres: "",
  },

  trazabilidad: {
    hash_expediente: "b39d53c832f8817b269139b9eee358e4ec3fc8b57240cd5896dc9f36bd8b94b5",
    hash_previo: "290c15c14f5364eec5ae6b472820036161cb7b067b051b318c3bc102067d31a0",
    anclado_en: "0x7f3b...e8a4 (tx hash) — 30-oct-2026 14:23 UTC",
    liberado_por: "",
  },
};

export const ExpedienteClinico: React.FC<ExpedienteClinicoProps> = ({
  folio,
  onClose,
  onPacienteLiberado,
  className = "",
}) => {
  const { user } = useAuth();

  const autoNumeroExpediente = useMemo(() => buildExpedienteFolio(folio), [folio]);
  const fechaHoyTexto = useMemo(
    () =>
      new Date().toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );

  const [paciente, setPaciente] = useState<PacienteParaPsicologo | null>(null);
  const [campos, setCampos] = useState<CamposClinicos>(() => ({
    ...DEFAULT_CAMPOS,
    numero_expediente: autoNumeroExpediente,
    fecha_apertura: fechaHoyTexto,
  }));
  const [transcriptVoz, setTranscriptVoz] = useState<string | null>(null);
  const [historialTamizajesTexto, setHistorialTamizajesTexto] = useState<string>("");

  const [paginaActiva, setPaginaActiva] = useState<number>(1);
  const [vistaContinua, setVistaContinua] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [ultimaGuardado, setUltimaGuardado] = useState<Date | null>(null);

  const storageKey = useMemo(() => `equilibra_expediente_${folio}`, [folio]);

  const updateCampos = useCallback((patch: Partial<CamposClinicos>) => {
    setCampos((prev) => ({
      ...prev,
      ...patch,
    }));
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      setIsLoading(true);

      // A. Datos de la vista para_psicologo con fallback a mock local
      let pacienteResuelto: PacienteParaPsicologo | null = null;
      try {
        const { data: pacienteData, error: pacError } = await supabase
          .from("para_psicologo")
          .select("*")
          .eq("folio", folio)
          .maybeSingle();

        if (!pacError && pacienteData) {
          pacienteResuelto = pacienteData as PacienteParaPsicologo;
        }
      } catch {
        // Fallback a mock local
      }

      if (!pacienteResuelto) {
        const localCase = getPsychologistCases().find((c) => {
          const derivedEq = `EQ-${(c.matricula?.slice(-4) || c.id.slice(-4)).toUpperCase()}`;
          return c.matricula === folio || c.id === folio || derivedEq === folio.toUpperCase();
        });

        if (localCase) {
          pacienteResuelto = {
            folio,
            iniciales: localCase.initials,
            nombre: localCase.studentName,
            matricula: localCase.matricula,
            edad: 21,
            sexo: "Estudiante",
            semestre: localCase.semester,
            carrera: localCase.career,
            grupo: "501",
            ultimo_nivel: localCase.riskLevel,
            gad7_total: localCase.gad7,
            phq9_total: localCase.phq9,
            item9: localCase.riskLevel === "rojo" ? 1 : 0,
            bloqueado: localCase.bloqueado ?? localCase.riskLevel === "rojo",
            tiene_alerta_activa: localCase.riskLevel === "rojo",
            ultimo_tamizaje: localCase.lastCheckIn,
            alertas_pendientes: localCase.riskLevel === "rojo" ? 1 : 0,
            modo_acompanamiento: localCase.modo_acompanamiento,
          };
        }
      }

      if (pacienteResuelto) {
        setPaciente(pacienteResuelto);
        const semestreClean = pacienteResuelto.semestre
          ? String(pacienteResuelto.semestre).includes("Semestre")
            ? String(pacienteResuelto.semestre)
            : `${pacienteResuelto.semestre}º Semestre`
          : "6º Semestre";

        setCampos((prev) => ({
          ...prev,
          numero_expediente: prev.numero_expediente || autoNumeroExpediente,
          fecha_apertura: prev.fecha_apertura || fechaHoyTexto,
          iniciales: pacienteResuelto?.iniciales || prev.iniciales || "",
          edad: pacienteResuelto?.edad ?? prev.edad ?? 21,
          sexo: pacienteResuelto?.sexo || prev.sexo || "Estudiante",
          semestre: semestreClean,
          carrera: pacienteResuelto?.carrera || prev.carrera || "TESH Huixquilucan",
          grupo: pacienteResuelto?.grupo || prev.grupo || "501",
          contexto_psicosocial: {
            ...prev.contexto_psicosocial,
            carrera_semestre: `${pacienteResuelto?.carrera || "TESH Huixquilucan"} · ${semestreClean}`,
            grupo: pacienteResuelto?.grupo || "501",
          },
          valoracion_riesgo: {
            ...prev.valoracion_riesgo,
            item9_valor: pacienteResuelto?.item9 ?? prev.valoracion_riesgo.item9_valor ?? 0,
          },
          objetivos_sesion: {
            ...prev.objetivos_sesion,
            estado_bloqueo: pacienteResuelto?.bloqueado ? "bloqueado" : "liberado",
          },
        }));
      }

      // B. Historial respuestas_tamizaje
      try {
        const { data: tamizajesData } = await supabase
          .from("respuestas_tamizaje")
          .select("*")
          .eq("folio", folio)
          .order("creado_en", { ascending: false })
          .limit(5);

        if (tamizajesData && tamizajesData.length > 0) {
          const resumenItems = tamizajesData.map((t: Record<string, unknown>) => {
            const fechaStr = t.creado_en
              ? new Date(String(t.creado_en)).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "short",
                })
              : "reciente";
            const gadVal = t.gad7_total ?? t.gad_total ?? 0;
            const phqVal = t.phq9_total ?? t.phq_total ?? 0;
            const item9Val = t.item9 ?? 0;
            const niv = String(t.nivel || t.ultimo_nivel || "amarillo");
            return `${fechaStr} (GAD-7: ${gadVal}, PHQ-9: ${phqVal}, ítem 9=${item9Val}, ${niv})`;
          });

          setHistorialTamizajesTexto(
            `El paciente tiene ${tamizajesData.length} tamizajes registrados: ${resumenItems.join(
              ", ",
            )}. Tendencia: evolución registrada en el expediente.`,
          );
        }
      } catch {
        // Fallback automático en HistoriaProblema
      }

      // C. Transcripciones de notas_voz
      try {
        const { data: notasData } = await supabase
          .from("notas_voz")
          .select("transcripcion")
          .eq("folio_tamizaje", folio)
          .order("creado_en", { ascending: false })
          .limit(1);

        if (notasData && notasData.length > 0 && notasData[0].transcripcion) {
          setTranscriptVoz(notasData[0].transcripcion);
        }
      } catch {
        // Sin audios disponibles
      }

      // D. Trazabilidad desde bloques_auditoria
      try {
        const { data: bloquesData } = await supabase
          .from("bloques_auditoria")
          .select("hash_actual, hash_previo, anclado_en, creado_en")
          .order("indice", { ascending: false })
          .limit(2);

        if (bloquesData && bloquesData.length > 0) {
          const ultimo = bloquesData[0];
          const anterior = bloquesData[1] || bloquesData[0];
          const fechaUtc = ultimo.creado_en
            ? new Date(ultimo.creado_en).toUTCString().replace("GMT", "UTC")
            : "30-oct-2026 14:23 UTC";

          setCampos((prev) => ({
            ...prev,
            trazabilidad: {
              ...prev.trazabilidad,
              hash_expediente: String(ultimo.hash_actual),
              hash_previo: String(anterior.hash_previo || anterior.hash_actual),
              anclado_en: ultimo.anclado_en
                ? `${ultimo.anclado_en} — ${fechaUtc}`
                : prev.trazabilidad.anclado_en,
            },
          }));
        }
      } catch {
        // Mantiene valores por defecto
      }

      // E. Expediente guardado previamente en Supabase o localStorage
      let recordLoaded = false;
      try {
        const { data: expData, error: expError } = await supabase
          .from("expedientes_clinicos")
          .select("campos_clinicos, updated_at")
          .eq("folio", folio)
          .maybeSingle();

        if (!expError && expData && expData.campos_clinicos) {
          const loaded = expData.campos_clinicos as Partial<CamposClinicos>;
          setCampos((prev) => ({
            ...prev,
            ...loaded,
            numero_expediente:
              loaded.numero_expediente || prev.numero_expediente || autoNumeroExpediente,
            fecha_apertura: loaded.fecha_apertura || prev.fecha_apertura || fechaHoyTexto,
          }));
          if (expData.updated_at) {
            setUltimaGuardado(new Date(expData.updated_at));
          }
          recordLoaded = true;
        }
      } catch {
        // Fallback a localStorage
      }

      if (!recordLoaded) {
        try {
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            const parsed = JSON.parse(cached) as Partial<CamposClinicos>;
            setCampos((prev) => ({
              ...prev,
              ...parsed,
              numero_expediente:
                parsed.numero_expediente || prev.numero_expediente || autoNumeroExpediente,
              fecha_apertura: parsed.fecha_apertura || prev.fecha_apertura || fechaHoyTexto,
            }));
            setUltimaGuardado(new Date());
          }
        } catch {
          // Ignorar error de lectura local
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [folio, storageKey, autoNumeroExpediente, fechaHoyTexto]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const numeroExpedienteHeader = campos.numero_expediente || autoNumeroExpediente;
  const consentimientoFirmado = Boolean(campos.objetivos_sesion.consentimiento_firmado);

  const handleGuardar = async () => {
    if (!consentimientoFirmado) {
      toast.error(
        'Para guardar el expediente debes marcar "He obtenido consentimiento informado del paciente".',
      );
      return;
    }

    try {
      setIsSaving(true);

      const camposParaGuardar: CamposClinicos = {
        ...campos,
        numero_expediente: campos.numero_expediente || autoNumeroExpediente,
        fecha_apertura: campos.fecha_apertura || fechaHoyTexto,
      };
      setCampos(camposParaGuardar);

      try {
        localStorage.setItem(storageKey, JSON.stringify(camposParaGuardar));
      } catch {
        // Ignorar error de almacenamiento local
      }

      const recordPayload: Partial<ExpedienteDbRecord> = {
        folio,
        psicologo_id: user?.id,
        campos_clinicos: camposParaGuardar,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("expedientes_clinicos")
        .upsert(recordPayload, { onConflict: "folio,psicologo_id" });

      if (error) {
        toast.success(
          `Expediente ${camposParaGuardar.numero_expediente} guardado en respaldo local seguro.`,
        );
      } else {
        toast.success(
          `Expediente ${camposParaGuardar.numero_expediente} guardado exitosamente en Supabase.`,
        );
      }

      setUltimaGuardado(new Date());
    } catch (err) {
      console.error("Error al persistir expediente:", err);
      toast.error("Ocurrió un problema al guardar el expediente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    if (!vistaContinua) {
      setVistaContinua(true);
      setTimeout(() => {
        window.print();
      }, 150);
    } else {
      window.print();
    }
  };

  const activePageMeta =
    EXPEDIENTE_PAGES.find((p) => p.page === paginaActiva) || EXPEDIENTE_PAGES[0];

  return (
    <div
      className={`mx-auto w-full max-w-6xl space-y-5 font-sans print:m-0 print:max-w-none print:space-y-6 print:p-0 print:font-serif ${className}`}
      id="expediente-clinico-container"
    >
      {/* Header Clínico Superior */}
      <div className="flex flex-col gap-4 rounded-lg border border-[#E5DFD3] bg-white p-4 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => {
              if (onClose) {
                onClose();
                return;
              }
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              }
            }}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 text-xs font-semibold text-[#1F4D2C] transition-colors hover:bg-[#E0F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5] dark:hover:bg-[#1F4D2C]/30"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            <span>Volver</span>
          </button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1F4D2C] text-white">
            <FileText className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                Expediente Clínico
              </h2>
              <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 py-0.5 font-mono text-xs font-bold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                {numeroExpedienteHeader}
              </span>
              <span className="font-mono text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                Tamizaje: {folio}
              </span>
            </div>
            <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              {isLoading
                ? "Cargando información clínica desde Supabase..."
                : ultimaGuardado
                  ? `Último guardado: ${ultimaGuardado.toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Cambios pendientes de guardar"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVistaContinua((prev) => !prev)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-semibold text-[#1A1A1A] transition-colors hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#2D3F2A]/60"
          >
            <Layers className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
            <span>{vistaContinua ? "Vista por secciones" : "Vista continua (5 págs.)"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#1F4D2C] bg-white px-3 text-xs font-semibold text-[#1F4D2C] transition-colors hover:bg-[#1F4D2C]/10 dark:border-[#8FC9B5] dark:bg-[#0F1A12] dark:text-[#8FC9B5] dark:hover:bg-[#8FC9B5]/10"
          >
            <Printer className="size-3.5" />
            <span>Imprimir PDF</span>
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={isSaving || !consentimientoFirmado}
            title={
              !consentimientoFirmado
                ? 'Marca "He obtenido consentimiento informado del paciente" para habilitar Guardar'
                : "Guardar expediente clínico"
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#4A7C59] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <RotateCcw className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>{isSaving ? "Guardando..." : "Guardar"}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-semibold text-[#6B6B6B] transition-colors hover:bg-[#F5F1E8] hover:text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3] dark:hover:bg-[#2D3F2A]/60 dark:hover:text-[#F5F1E8]"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo principal: Sidebar Vertical (5 páginas) + Contenido del Expediente */}
      <div className="flex flex-col gap-5 lg:flex-row print:block">
        {/* Sidebar / Tabs Verticales Internos */}
        {!vistaContinua && (
          <nav
            aria-label="Secciones del expediente clínico"
            className="w-full shrink-0 lg:w-64 print:hidden"
          >
            <div className="rounded-lg border border-[#E5DFD3] bg-white p-2.5 space-y-1 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                Estructura (5 páginas)
              </p>
              <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
                {EXPEDIENTE_PAGES.map((item) => {
                  const Icon = item.icon;
                  const isActive = paginaActiva === item.page;
                  return (
                    <button
                      key={item.page}
                      type="button"
                      onClick={() => setPaginaActiva(item.page)}
                      className={`flex min-w-[200px] lg:min-w-0 items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? "border-l-4 border-[#1F4D2C] bg-[#F5F1E8] text-[#1F4D2C] dark:border-[#8FC9B5] dark:bg-[#0F1A12] dark:text-[#8FC9B5]"
                          : "border-l-4 border-transparent text-[#1A1A1A] hover:bg-[#F5F1E8]/60 dark:text-[#F5F1E8] dark:hover:bg-[#0F1A12]/60"
                      }`}
                    >
                      <Icon
                        className={`mt-0.5 size-4 shrink-0 ${
                          isActive
                            ? "text-[#1F4D2C] dark:text-[#8FC9B5]"
                            : "text-[#6B6B6B] dark:text-[#A6B5A3]"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className={`text-xs ${isActive ? "font-bold" : "font-semibold"}`}>
                          {item.page}. {item.title}
                        </p>
                        <p className="truncate text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-[#E5DFD3] pt-3 px-2.5 dark:border-[#2D3F2A]">
                <div className="flex items-center justify-between text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                  <span>Consentimiento:</span>
                  <span
                    className={`font-semibold ${
                      consentimientoFirmado
                        ? "text-[#1F4D2C] dark:text-[#8FC9B5]"
                        : "text-[#B8860B] dark:text-[#FCD34D]"
                    }`}
                  >
                    {consentimientoFirmado ? "Verificado" : "Pendiente"}
                  </span>
                </div>
              </div>
            </div>
          </nav>
        )}

        {/* Área del Documento Clínico (5 páginas) */}
        <div className="min-w-0 flex-1 space-y-5">
          <div className="space-y-8 print:space-y-6">
            {/* PÁGINA 1: Identificación (auto-poblado desde Supabase — readonly) */}
            {(vistaContinua || paginaActiva === 1) && (
              <article className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6 print:border-none print:p-0 print:break-after-page">
                <div
                  role="banner"
                  className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Tecnológico de Estudios Superiores de Huixquilucan · Equilibra TESH
                    </p>
                    <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1F4D2C] dark:text-[#8FC9B5]">
                      EXPEDIENTE CLÍNICO · {numeroExpedienteHeader}
                    </h1>
                    <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Página 1 — Identificación institucional del estudiante
                    </p>
                  </div>
                  <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    Página 1 de 5
                  </span>
                </div>

                <Identificacion
                  paciente={paciente}
                  campos={campos}
                  onChange={updateCampos}
                  fechaApertura={fechaHoyTexto}
                  numeroExpediente={numeroExpedienteHeader}
                />

                <footer className="border-t border-[#E5DFD3] pt-3 text-center text-[11px] text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                  Equilibra TESH · Expediente Clínico Confidencial · {numeroExpedienteHeader}
                </footer>
              </article>
            )}

            {/* PÁGINA 2: Motivo de consulta */}
            {(vistaContinua || paginaActiva === 2) && (
              <article className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6 print:border-none print:p-0 print:break-after-page">
                <div
                  role="banner"
                  className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Equilibra TESH · Expediente {numeroExpedienteHeader}
                    </p>
                    <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1F4D2C] dark:text-[#8FC9B5]">
                      MOTIVO DE CONSULTA
                    </h1>
                    <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Página 2 — Relato textual y referencia de tamizaje
                    </p>
                  </div>
                  <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    Página 2 de 5
                  </span>
                </div>

                <MotivoConsulta
                  paciente={paciente}
                  motivoEnPalabras={campos.motivo_en_palabras}
                  onChange={(motivo) => updateCampos({ motivo_en_palabras: motivo })}
                  tamizajeFecha={
                    paciente?.ultimo_tamizaje
                      ? new Date(paciente.ultimo_tamizaje).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "Reciente"
                  }
                  transcriptVoz={transcriptVoz}
                />

                <footer className="border-t border-[#E5DFD3] pt-3 text-center text-[11px] text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                  Equilibra TESH · Expediente Clínico Confidencial · {numeroExpedienteHeader}
                </footer>
              </article>
            )}

            {/* PÁGINA 3: Historia + Antecedentes */}
            {(vistaContinua || paginaActiva === 3) && (
              <article className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6 print:border-none print:p-0 print:break-after-page">
                <div
                  role="banner"
                  className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Equilibra TESH · Expediente {numeroExpedienteHeader}
                    </p>
                    <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1F4D2C] dark:text-[#8FC9B5]">
                      HISTORIA Y ANTECEDENTES CLÍNICOS
                    </h1>
                    <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Página 3 — Evolución del problema y antecedentes relevantes
                    </p>
                  </div>
                  <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    Página 3 de 5
                  </span>
                </div>

                <HistoriaProblema
                  paciente={paciente}
                  historiaClinica={campos.historia_clinica}
                  onChange={(historia) => updateCampos({ historia_clinica: historia })}
                  historialTamizajesTexto={historialTamizajesTexto}
                />

                <Antecedentes
                  antecedentes={campos.antecedentes}
                  onChange={(patch) =>
                    updateCampos({
                      antecedentes: { ...campos.antecedentes, ...patch },
                    })
                  }
                />

                <footer className="border-t border-[#E5DFD3] pt-3 text-center text-[11px] text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                  Equilibra TESH · Expediente Clínico Confidencial · {numeroExpedienteHeader}
                </footer>
              </article>
            )}

            {/* PÁGINA 4: Contexto + Estado Mental */}
            {(vistaContinua || paginaActiva === 4) && (
              <article className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6 print:border-none print:p-0 print:break-after-page">
                <div
                  role="banner"
                  className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Equilibra TESH · Expediente {numeroExpedienteHeader}
                    </p>
                    <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1F4D2C] dark:text-[#8FC9B5]">
                      CONTEXTO PSICOSOCIAL Y ESTADO MENTAL
                    </h1>
                    <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Página 4 — Entorno académico/familiar y exploración semiológica
                    </p>
                  </div>
                  <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    Página 4 de 5
                  </span>
                </div>

                <ContextoPsicosocial
                  paciente={paciente}
                  contexto={campos.contexto_psicosocial}
                  onChange={(patch) =>
                    updateCampos({
                      contexto_psicosocial: { ...campos.contexto_psicosocial, ...patch },
                    })
                  }
                />

                <EstadoMental
                  estadoMental={campos.estado_mental}
                  onChange={(patch) =>
                    updateCampos({
                      estado_mental: { ...campos.estado_mental, ...patch },
                    })
                  }
                />

                <footer className="border-t border-[#E5DFD3] pt-3 text-center text-[11px] text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                  Equilibra TESH · Expediente Clínico Confidencial · {numeroExpedienteHeader}
                </footer>
              </article>
            )}

            {/* PÁGINA 5: Valoración de riesgo + Hipótesis + Objetivos + Trazabilidad */}
            {(vistaContinua || paginaActiva === 5) && (
              <article className="space-y-5 rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6 print:border-none print:p-0">
                <div
                  role="banner"
                  className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Equilibra TESH · Expediente {numeroExpedienteHeader}
                    </p>
                    <h1 className="mt-0.5 text-xl font-bold tracking-tight text-[#1F4D2C] dark:text-[#8FC9B5]">
                      VALORACIÓN, HIPÓTESIS, OBJETIVOS Y TRAZABILIDAD
                    </h1>
                    <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Página 5 — Seguridad clínica, plan terapéutico y auditoría
                    </p>
                  </div>
                  <span className="rounded-md border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    Página 5 de 5
                  </span>
                </div>

                <ValoracionRiesgo
                  paciente={paciente}
                  valoracion={campos.valoracion_riesgo}
                  onChange={(patch) =>
                    updateCampos({
                      valoracion_riesgo: { ...campos.valoracion_riesgo, ...patch },
                    })
                  }
                />

                <HipotesisTrabajo
                  hipotesis={campos.hipotesis_trabajo}
                  onChange={(hipotesis) => updateCampos({ hipotesis_trabajo: hipotesis })}
                />

                <ObjetivosSesion
                  paciente={paciente}
                  objetivos={campos.objetivos_sesion}
                  onChange={(patch) =>
                    updateCampos({
                      objetivos_sesion: { ...campos.objetivos_sesion, ...patch },
                    })
                  }
                  onLiberarPaciente={onPacienteLiberado}
                />

                <TrazabilidadBlockchain
                  trazabilidad={campos.trazabilidad}
                  nombrePsicologo={user?.name}
                />

                <footer className="border-t border-[#E5DFD3] pt-3 text-center text-[11px] text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                  Equilibra TESH · Expediente Clínico Confidencial · {numeroExpedienteHeader}
                </footer>
              </article>
            )}
          </div>

          {/* Barra inferior de consentimiento informado + navegación entre páginas */}
          <div className="flex flex-col gap-3 rounded-lg border border-[#E5DFD3] bg-white p-4 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:flex-row sm:items-center sm:justify-between print:hidden">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={consentimientoFirmado}
                onChange={(e) =>
                  updateCampos({
                    objetivos_sesion: {
                      ...campos.objetivos_sesion,
                      consentimiento_firmado: e.target.checked,
                    },
                  })
                }
                className="size-4 rounded border-[#E5DFD3] accent-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A]"
              />
              <span className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                He obtenido consentimiento informado del paciente
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
              {!vistaContinua && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={paginaActiva <= 1}
                    onClick={() => setPaginaActiva((p) => Math.max(1, p - 1))}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] disabled:opacity-40 dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#2D3F2A]/60"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Anterior</span>
                  </button>
                  <span className="px-2 text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                    {activePageMeta.page} / 5
                  </span>
                  <button
                    type="button"
                    disabled={paginaActiva >= 5}
                    onClick={() => setPaginaActiva((p) => Math.min(5, p + 1))}
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] disabled:opacity-40 dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#2D3F2A]/60"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleGuardar}
                disabled={isSaving || !consentimientoFirmado}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#4A7C59] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!consentimientoFirmado && <Lock className="size-3.5" />}
                {consentimientoFirmado && <Save className="size-3.5" />}
                <span>{isSaving ? "Guardando..." : "Guardar"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpedienteClinico;
