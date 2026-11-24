import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  Blocks,
  CalendarClock,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Link as LinkIcon,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import {
  InstitutionalSidebar,
  type InstitutionalSidebarItem,
} from "@/components/layout/institutional-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-context";
import {
  POLYGON_AMOY_CONFIG,
  fetchUltimosBloques,
  formatShortHash,
  verificarCadenaAuditoria,
  type AuditBlock,
  type VerificationResult,
} from "@/lib/blockchain-audit";

type AuditoriaSection = "cadena" | "verificacion" | "resumen";

const SECTION_LABELS: Record<AuditoriaSection, string> = {
  cadena: "Cadena de bloques",
  verificacion: "Verificación",
  resumen: "Resumen",
};

const SENSITIVE_PAYLOAD_KEYS = new Set([
  "nombre",
  "apellido",
  "apellidos",
  "email",
  "correo",
  "matricula",
  "curp",
  "telefono",
  "diagnostico",
  "nota",
  "notas",
  "observaciones",
  "respuestas",
  "pregunta",
  "contenido",
  "texto",
  "paciente_id",
  "estudiante_id",
  "user_id",
  "usuario_id",
  "psicologo_id",
]);

function truncateHash12(hash: string): string {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

function formatBlockTimestamp(iso: string): string {
  try {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface EventTypeMeta {
  label: string;
  pillClassName: string;
}

function getEventTypeMeta(tipoEvento: string): EventTypeMeta {
  const upper = tipoEvento.toUpperCase();

  if (upper.includes("TAMIZAJE")) {
    return {
      label: "Tamizaje completado",
      pillClassName:
        "bg-[#1F4D2C]/10 text-[#1F4D2C] border border-[#1F4D2C]/25 dark:bg-[#8FC9B5]/15 dark:text-[#8FC9B5]",
    };
  }
  if (upper.includes("NOTA") || upper.includes("EXPEDIENTE")) {
    return {
      label: "Expediente guardado",
      pillClassName:
        "bg-[#4A7C59]/15 text-[#1F4D2C] border border-[#4A7C59]/30 dark:bg-[#4A7C59]/25 dark:text-[#E5DFD3]",
    };
  }
  if (upper.includes("ENCUESTA")) {
    return {
      label: "Encuesta enviada",
      pillClassName:
        "bg-[#B8860B]/15 text-[#8A6406] border border-[#B8860B]/30 dark:bg-[#B8860B]/20 dark:text-[#F5C7A8]",
    };
  }
  if (upper.includes("CRISIS")) {
    return {
      label: "Alerta atendida",
      pillClassName:
        "bg-[#FEE2E2] text-[#C8102E] border border-[#C8102E]/30 dark:bg-[#C8102E]/20 dark:text-[#FEE2E2]",
    };
  }
  if (upper.includes("CITA")) {
    return {
      label: "Cita confirmada",
      pillClassName:
        "bg-[#F5F1E8] text-[#1A1A1A] border border-[#E5DFD3] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:border-[#2D3F2A]",
    };
  }
  if (upper.includes("GENESIS")) {
    return {
      label: "Bloque génesis",
      pillClassName: "bg-[#1F4D2C] text-white border border-[#1F4D2C]",
    };
  }

  return {
    label: tipoEvento
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase()),
    pillClassName:
      "bg-[#F5F1E8] text-[#6B6B6B] border border-[#E5DFD3] dark:bg-[#0F1A12] dark:text-[#A6B5A3] dark:border-[#2D3F2A]",
  };
}

function buildSanitizedPayload(block: AuditBlock): Record<string, unknown> {
  const safeExtra: Record<string, unknown> = {};
  if (block.datos && typeof block.datos === "object") {
    for (const [key, val] of Object.entries(block.datos)) {
      if (!SENSITIVE_PAYLOAD_KEYS.has(key.toLowerCase())) {
        safeExtra[key] = val;
      }
    }
  }

  return {
    bloque_indice: block.indice,
    tipo_evento: getEventTypeMeta(block.tipo_evento).label,
    codigo_evento: block.tipo_evento,
    timestamp_utc: block.creado_en,
    hash_sha256: block.hash_actual,
    hash_previo: block.hash_previo,
    red_anclaje: {
      nombre: POLYGON_AMOY_CONFIG.name,
      chain_id: POLYGON_AMOY_CONFIG.chainId,
      tx_hash: block.anclado_en || null,
      bloque_externo: block.bloque_ext || null,
    },
    metadatos_no_sensibles:
      Object.keys(safeExtra).length > 0 ? safeExtra : { origen: "pgcrypto_audit" },
    garantia_privacidad: "Solo hash SHA-256 on-chain; cero datos clínicos o personales.",
  };
}

function getNextScheduledAnchor(): { formatted: string; countdown: string } {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() + 1);

  const diffMins = Math.max(1, Math.round((next.getTime() - now.getTime()) / 60000));
  const formatted = next.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    formatted,
    countdown: `En ${diffMins} min (lote horario)`,
  };
}

export function AuditoriaPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeSection, setActiveSection] = useState<AuditoriaSection>("cadena");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [bloques, setBloques] = useState<AuditBlock[]>([]);
  const [totalBloques, setTotalBloques] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedBlock, setSelectedBlock] = useState<AuditBlock | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyProgress, setVerifyProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [verificacion, setVerificacion] = useState<VerificationResult | null>(null);

  const cargarBloques = async () => {
    setIsLoading(true);
    try {
      const res = await fetchUltimosBloques(30);
      const sortedDesc = [...res.bloques].sort((a, b) => b.indice - a.indice);
      setBloques(sortedDesc);
      setTotalBloques(res.total);
    } catch {
      toast.error("No se pudieron cargar los bloques de auditoría.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarBloques();
  }, []);

  const linkIntegrityMap = useMemo(() => {
    const asc = [...bloques].sort((a, b) => a.indice - b.indice);
    const map = new Map<number, boolean>();

    for (let i = 0; i < asc.length; i++) {
      const curr = asc[i];
      if (i === 0) {
        map.set(curr.indice, Boolean(curr.hash_actual));
      } else {
        const prev = asc[i - 1];
        map.set(curr.indice, curr.hash_previo === prev.hash_actual);
      }
    }
    return map;
  }, [bloques]);

  const anchoredBlocks = useMemo(() => {
    return [...bloques].filter((b) => Boolean(b.anclado_en)).sort((a, b) => b.indice - a.indice);
  }, [bloques]);

  const latestAnchored = anchoredBlocks[0] || null;
  const nextAnchorInfo = useMemo(() => getNextScheduledAnchor(), []);

  const handleCopy = (value: string, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedValue(value);
    toast.success(`${label} copiado al portapapeles.`);
    setTimeout(() => {
      setCopiedValue((prev) => (prev === value ? null : prev));
    }, 2000);
  };

  const handleVerificarCadena = async () => {
    if (isVerifying) return;

    const total = Math.max(bloques.length, 1);
    setIsVerifying(true);
    setVerificacion(null);
    setVerifyProgress({ current: 1, total });

    try {
      const verificationPromise = verificarCadenaAuditoria(bloques);

      for (let step = 1; step <= total; step++) {
        setVerifyProgress({ current: step, total });
        await new Promise((resolve) => setTimeout(resolve, Math.min(180, Math.round(900 / total))));
      }

      const resultado = await verificationPromise;
      setVerificacion(resultado);

      if (resultado.valida) {
        toast.success("Cadena íntegra", {
          description: `${resultado.total_bloques} bloques verificados mediante SHA-256 sin alteraciones.`,
          style: {
            backgroundColor: "#E0F0E8",
            borderColor: "#8FC9B5",
            color: "#1F4D2C",
          },
        });
      } else {
        toast.error("Alteración detectada en la cadena", {
          description:
            resultado.error ||
            `Inconsistencia detectada en el bloque #${resultado.indice_alterado}.`,
          style: {
            backgroundColor: "#FEE2E2",
            borderColor: "#C8102E",
            color: "#C8102E",
          },
        });
      }
    } catch {
      toast.error("Error al ejecutar la verificación de cadena.");
    } finally {
      setIsVerifying(false);
      setVerifyProgress(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.info("Has cerrado sesión institucional.");
    navigate({ to: "/login", replace: true });
  };

  const sidebarItems: InstitutionalSidebarItem[] = [
    {
      id: "cadena",
      label: "Cadena de bloques",
      icon: Blocks,
      badge: bloques.length || null,
      badgeClassName: "bg-[#1F4D2C] text-white border border-white/15",
    },
    {
      id: "verificacion",
      label: "Verificación",
      icon: ShieldCheck,
    },
    {
      id: "resumen",
      label: "Resumen",
      icon: BarChart3,
    },
  ];

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    {
      label: "Panel institucional",
      onClick: () => navigate({ to: "/directivo" }),
    },
    {
      label: "Auditoría blockchain",
      onClick: () => setActiveSection("cadena"),
    },
    {
      label: SECTION_LABELS[activeSection],
    },
  ];

  const getBlockVerificationStatus = (block: AuditBlock): "valido" | "pendiente" | "invalido" => {
    const isConsistent = linkIntegrityMap.get(block.indice) ?? true;
    const failedVerify =
      verificacion && !verificacion.valida && verificacion.indice_alterado === block.indice;

    if (!isConsistent || failedVerify) return "invalido";
    if (block.anclado_en) return "valido";
    return "pendiente";
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen flex-col bg-[#F5F1E8] font-sans text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
        <InstitutionalHeader
          moduleTitle="Auditoría blockchain"
          titleBadge={
            <span className="inline-flex items-center rounded-full bg-[#B8860B] px-3 py-1 text-xs font-semibold text-white">
              Polygon Amoy Testnet
            </span>
          }
          breadcrumbs={breadcrumbs}
          onHomeClick={() => navigate({ to: "/directivo" })}
          showCrisisButton={false}
          showSidebarToggle={true}
          isSidebarOpen={isMobileSidebarOpen}
          onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          sidebarOffsetClassName="lg:pl-64"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cargarBloques}
                disabled={isLoading}
                className="h-9 cursor-pointer gap-1.5 rounded-lg border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15 hover:text-white"
              >
                <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
              <AjustesModal
                rol={user?.role || "directivo"}
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
          <InstitutionalSidebar
            items={sidebarItems}
            activeId={activeSection}
            onSelect={(id) => setActiveSection(id as AuditoriaSection)}
            ariaLabel="Secciones de auditoría blockchain"
            sectionTitle="Auditoría Blockchain"
            onLogout={handleLogout}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />

          <div className="min-w-0 flex-1 lg:pl-64">
            <main className="mx-auto w-full max-w-6xl p-4 pb-16 sm:p-6 lg:p-8">
              {/* Badge de red visible también en pantallas pequeñas */}
              <div className="mb-4 flex items-center justify-between sm:hidden">
                <span className="inline-flex items-center rounded-full bg-[#B8860B] px-3 py-1 text-xs font-semibold text-white">
                  Polygon Amoy Testnet
                </span>
                <span className="font-mono text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Chain ID {POLYGON_AMOY_CONFIG.chainId}
                </span>
              </div>

              {/* SECCIÓN 1: CADENA DE BLOQUES */}
              {activeSection === "cadena" && (
                <section aria-labelledby="auditoria-cadena-heading" className="space-y-4">
                  <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
                    <div>
                      <h2
                        id="auditoria-cadena-heading"
                        className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]"
                      >
                        Cadena de bloques
                      </h2>
                      <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                        Registro cronológico inverso de huellas SHA-256 encadenadas sin exposición
                        de datos clínicos.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-[#E5DFD3] bg-white px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]">
                        {bloques.length} bloques visibles
                      </span>
                      <Button
                        type="button"
                        onClick={() => setActiveSection("verificacion")}
                        className="h-9 cursor-pointer rounded-lg bg-[#1F4D2C] px-3.5 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                      >
                        <ShieldCheck className="mr-1.5 size-3.5" />
                        Ir a verificación
                      </Button>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="space-y-2.5">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="h-20 w-full animate-pulse rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                        />
                      ))}
                    </div>
                  ) : bloques.length === 0 ? (
                    <div className="rounded-lg border border-[#E5DFD3] bg-white p-10 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        No hay bloques registrados en este momento.
                      </p>
                      <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Intenta recargar la bitácora desde el botón Actualizar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {bloques.map((b) => {
                        const eventMeta = getEventTypeMeta(b.tipo_evento);
                        const status = getBlockVerificationStatus(b);

                        return (
                          <article
                            key={b.indice}
                            className="rounded-lg border border-[#E5DFD3] bg-white p-3.5 transition-colors hover:border-[#1F4D2C]/40 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              {/* Avatar cuadrado + Block # + timestamp */}
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  aria-hidden="true"
                                  className="grid size-10 shrink-0 place-items-center rounded-md border border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                                >
                                  <LinkIcon size={20} color="#1F4D2C" strokeWidth={1.9} />
                                </div>

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-sm font-bold tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
                                      Block #{b.indice}
                                    </span>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${eventMeta.pillClassName}`}
                                    >
                                      {eventMeta.label}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-xs tabular-nums text-[#6B6B6B] dark:text-[#A6B5A3]">
                                    {formatBlockTimestamp(b.creado_en)}
                                  </p>
                                </div>
                              </div>

                              {/* Hashes SHA-256 truncados con Tooltip + Estado + Ver detalle */}
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:flex lg:items-center lg:gap-4">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                                    Hash SHA-256
                                  </p>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopy(b.hash_actual, `Hash bloque #${b.indice}`)
                                        }
                                        className="cursor-pointer font-mono text-xs font-semibold tabular-nums text-[#1A1A1A] underline-offset-2 hover:text-[#1F4D2C] hover:underline dark:text-[#F5F1E8] dark:hover:text-[#8FC9B5]"
                                      >
                                        {truncateHash12(b.hash_actual)}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="max-w-sm break-all bg-[#1A1A1A] font-mono text-[11px] text-white"
                                    >
                                      {b.hash_actual}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-[11px] font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                                    Hash previo
                                  </p>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCopy(b.hash_previo, `Hash previo #${b.indice}`)
                                        }
                                        className="cursor-pointer font-mono text-xs tabular-nums text-[#6B6B6B] underline-offset-2 hover:text-[#1F4D2C] hover:underline dark:text-[#A6B5A3] dark:hover:text-[#8FC9B5]"
                                      >
                                        {truncateHash12(b.hash_previo)}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="max-w-sm break-all bg-[#1A1A1A] font-mono text-[11px] text-white"
                                    >
                                      {b.hash_previo}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>

                                <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:justify-end">
                                  {status === "valido" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1F4D2C] px-2.5 py-1 text-[11px] font-semibold text-white">
                                      <Check className="size-3.5" strokeWidth={2.25} />
                                      Válido
                                    </span>
                                  )}
                                  {status === "pendiente" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#B8860B] px-2.5 py-1 text-[11px] font-semibold text-white">
                                      <Clock className="size-3.5" strokeWidth={2} />
                                      Pendiente
                                    </span>
                                  )}
                                  {status === "invalido" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#C8102E] px-2.5 py-1 text-[11px] font-semibold text-white">
                                      <AlertTriangle className="size-3.5" strokeWidth={2} />
                                      Inválido
                                    </span>
                                  )}

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedBlock(b)}
                                    className="h-8 cursor-pointer gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#8FC9B5] dark:hover:bg-[#0F1A12]"
                                  >
                                    <Eye className="size-3.5" />
                                    Ver detalle
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* SECCIÓN 2: VERIFICACIÓN */}
              {activeSection === "verificacion" && (
                <section aria-labelledby="auditoria-verificacion-heading" className="space-y-6">
                  <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                    <h2
                      id="auditoria-verificacion-heading"
                      className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]"
                    >
                      Verificación criptográfica
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                      Recalcula los digests SHA-256 mediante la Edge Function{" "}
                      <span className="font-mono font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                        verificar_cadena
                      </span>{" "}
                      (pgcrypto) y valida la continuidad de cada bloque.
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#E5DFD3] bg-white p-6 space-y-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Auditoría integral de la cadena
                        </h3>
                        <p className="text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Verifica que el hash previo de cada registro coincida matemáticamente con
                          el hash del bloque predecesor sin alteraciones.
                        </p>
                      </div>

                      <Button
                        type="button"
                        onClick={handleVerificarCadena}
                        disabled={isVerifying || isLoading}
                        className="h-11 shrink-0 cursor-pointer gap-2 rounded-lg bg-[#1F4D2C] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4A7C59] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isVerifying ? (
                          <>
                            <RefreshCw className="size-4 animate-spin" />
                            <span>Verificando...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="size-4" />
                            <span>Verificar cadena completa</span>
                          </>
                        )}
                      </Button>
                    </div>

                    {isVerifying && verifyProgress && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          <span className="tabular-nums">
                            Verificando bloque {verifyProgress.current} de {verifyProgress.total}...
                          </span>
                          <span className="font-mono tabular-nums">
                            {Math.round((verifyProgress.current / verifyProgress.total) * 100)}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
                          <div
                            className="h-full bg-[#1F4D2C] transition-all duration-150"
                            style={{
                              width: `${Math.round((verifyProgress.current / verifyProgress.total) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resultado grande */}
                  {verificacion && verificacion.valida && (
                    <div
                      role="status"
                      className="rounded-lg border-2 border-[#1F4D2C] bg-white p-6 sm:p-8 dark:border-[#8FC9B5] dark:bg-[#1A2618]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#1F4D2C] text-white">
                            <Check className="size-7" strokeWidth={2.25} />
                          </div>
                          <div className="space-y-1.5">
                            <h3 className="text-xl font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                              Cadena íntegra
                            </h3>
                            <p className="text-sm leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                              Se verificaron{" "}
                              <span className="font-mono font-bold tabular-nums">
                                {verificacion.total_bloques}
                              </span>{" "}
                              bloques consecutivos sin rupturas ni modificaciones en sus firmas
                              SHA-256.
                            </p>
                            <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                              <span>Head: {truncateHash12(verificacion.ultimo_hash)}</span>
                              <span aria-hidden="true">·</span>
                              <span>Anclados: {verificacion.anclados}</span>
                              <span aria-hidden="true">·</span>
                              <span>Método: {verificacion.metodo.replace(/_/g, " ")}</span>
                            </div>
                          </div>
                        </div>

                        <span className="shrink-0 font-mono text-xs tabular-nums text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {formatBlockTimestamp(verificacion.verificado_en)}
                        </span>
                      </div>
                    </div>
                  )}

                  {verificacion && !verificacion.valida && (
                    <div
                      role="alert"
                      className="rounded-lg border-2 border-[#C8102E] bg-[#FEE2E2] p-6 sm:p-8 text-[#1A1A1A]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[#C8102E] text-white">
                            <AlertTriangle className="size-7" strokeWidth={2} />
                          </div>
                          <div className="space-y-1.5">
                            <h3 className="text-xl font-bold text-[#C8102E]">
                              Inconsistencia detectada en la cadena
                            </h3>
                            <p className="text-sm font-medium text-[#1A1A1A]">
                              {verificacion.error ||
                                `Se detectó alteración en el bloque #${verificacion.indice_alterado ?? "desconocido"}.`}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 pt-1 font-mono text-xs text-[#9B0C24]">
                              {verificacion.indice_alterado !== undefined && (
                                <span>Bloque afectado: #{verificacion.indice_alterado}</span>
                              )}
                              <span>Total evaluados: {verificacion.total_bloques}</span>
                              <span>Método: {verificacion.metodo.replace(/_/g, " ")}</span>
                            </div>
                          </div>
                        </div>

                        <span className="shrink-0 font-mono text-xs tabular-nums text-[#9B0C24]">
                          {formatBlockTimestamp(verificacion.verificado_en)}
                        </span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* SECCIÓN 3: RESUMEN */}
              {activeSection === "resumen" && (
                <section aria-labelledby="auditoria-resumen-heading" className="space-y-6">
                  <div className="border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                    <h2
                      id="auditoria-resumen-heading"
                      className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]"
                    >
                      Resumen de anclaje institucional
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
                      Estado de anclajes periódicos en Polygon Amoy Testnet (Chain ID{" "}
                      {POLYGON_AMOY_CONFIG.chainId}).
                    </p>
                  </div>

                  {/* 3 KPIs */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <article className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Total de bloques anclados
                        </p>
                        <Blocks className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      </div>
                      <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-[#1F4D2C] dark:text-[#8FC9B5]">
                        {anchoredBlocks.length}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-[#6B6B6B] dark:text-[#A6B5A3]">
                        De {totalBloques || bloques.length} bloques registrados en bitácora
                      </p>
                    </article>

                    <article className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Último anclaje on-chain
                        </p>
                        <LinkIcon className="size-4 text-[#B8860B]" />
                      </div>
                      <p className="mt-3 text-base font-bold tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {latestAnchored
                          ? formatBlockTimestamp(latestAnchored.creado_en)
                          : "Sin anclajes previos"}
                      </p>
                      {latestAnchored?.anclado_en ? (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-mono text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {formatShortHash(latestAnchored.anclado_en)}
                          </span>
                          <a
                            href={`${POLYGON_AMOY_CONFIG.explorerBaseUrl}${latestAnchored.anclado_en}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4D2C] hover:underline dark:text-[#8FC9B5]"
                          >
                            PolygonScan
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Esperando primer envío a red pública
                        </p>
                      )}
                    </article>

                    <article className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Próximo anclaje programado
                        </p>
                        <CalendarClock className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      </div>
                      <p className="mt-3 text-base font-bold tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {nextAnchorInfo.formatted}
                      </p>
                      <p className="mt-2 text-xs font-medium text-[#B8860B] dark:text-[#F5C7A8]">
                        {nextAnchorInfo.countdown}
                      </p>
                    </article>
                  </div>

                  {/* Card informativa ShieldCheck */}
                  <article className="rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#E0F0E8] text-[#1F4D2C]">
                        <ShieldCheck className="size-6" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Solo el hash SHA-256 viaja on-chain. Cero datos clínicos en la blockchain.
                        </h3>
                        <p className="text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Las transacciones enviadas a {POLYGON_AMOY_CONFIG.name} registran
                          únicamente huellas criptográficas irreversibles de 256 bits para auditar
                          la inmutabilidad de los registros institucionales bajo la LFPDPPP. Ningún
                          nombre, matrícula, respuesta o nota psicológica sale de la base de datos
                          clínica cifrada.
                        </p>
                      </div>
                    </div>
                  </article>
                </section>
              )}
            </main>
          </div>
        </div>

        {/* Modal Ver Detalle de Bloque */}
        <Dialog
          open={Boolean(selectedBlock)}
          onOpenChange={(open) => {
            if (!open) setSelectedBlock(null);
          }}
        >
          <DialogContent className="max-w-2xl rounded-lg border border-[#E5DFD3] bg-white text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
            {selectedBlock && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 font-mono text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    <LinkIcon className="size-4" />
                    Detalle técnico — Block #{selectedBlock.indice}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                    {getEventTypeMeta(selectedBlock.tipo_evento).label} ·{" "}
                    {formatBlockTimestamp(selectedBlock.creado_en)}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                        Hash SHA-256 completo
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedBlock.hash_actual, "Hash SHA-256")}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#1F4D2C] hover:underline dark:text-[#8FC9B5]"
                      >
                        {copiedValue === selectedBlock.hash_actual ? (
                          <>
                            <Check className="size-3.5" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5" />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <p className="break-all rounded-md border border-[#E5DFD3] bg-[#F5F1E8]/60 p-2.5 font-mono text-xs text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
                      {selectedBlock.hash_actual}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Hash previo completo
                    </span>
                    <p className="break-all rounded-md border border-[#E5DFD3] bg-[#F5F1E8]/60 p-2.5 font-mono text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
                      {selectedBlock.hash_previo}
                    </p>
                  </div>

                  {selectedBlock.anclado_en && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E5DFD3] bg-[#F5F1E8]/60 p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Transacción en Polygon Amoy (#{selectedBlock.bloque_ext || "Tx"})
                        </p>
                        <p className="truncate font-mono text-xs text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {selectedBlock.anclado_en}
                        </p>
                      </div>
                      <a
                        href={`${POLYGON_AMOY_CONFIG.explorerBaseUrl}${selectedBlock.anclado_en}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#1F4D2C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                      >
                        Ver en PolygonScan
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Payload JSON (sin datos sensibles)
                    </span>
                    <pre className="max-h-56 overflow-auto rounded-md border border-[#E5DFD3] bg-[#0F1A12] p-3 font-mono text-xs leading-relaxed text-[#E5DFD3]">
                      {JSON.stringify(buildSanitizedPayload(selectedBlock), null, 2)}
                    </pre>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedBlock(null)}
                    className="h-9 cursor-pointer rounded-lg border-[#E5DFD3] text-xs font-semibold dark:border-[#2D3F2A]"
                  >
                    Cerrar
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
