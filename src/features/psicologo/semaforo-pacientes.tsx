import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  AlertTriangle,
  FileText,
  UserCheck,
  RefreshCw,
  Info,
  Clock,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mic,
  PhoneCall,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NotasVozModal } from "./notas-voz-modal";
import { ExpedienteClinico } from "./ExpedienteClinico";
import { ContactPatientDialog } from "./contact-patient-dialog";
import { getPsychologistCases, updateCaseStatus } from "@/lib/psychologist-store";
import type { CaseSummary, RiskLevel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export interface PacienteParaPsicologo {
  folio: string;
  iniciales: string;
  nombre?: string | null;
  matricula?: string | null;
  modo_acompanamiento?: boolean | null;
  caseId?: string | null;
  edad?: number | null;
  sexo?: string | null;
  semestre?: string | number | null;
  carrera?: string | null;
  grupo?: string | null;
  ultimo_nivel?: "rojo" | "amarillo" | "verde" | string | null;
  gad7_total?: number | null;
  phq9_total?: number | null;
  item9?: number | null;
  bloqueado?: boolean | null;
  tiene_alerta_activa?: boolean | null;
  ultimo_tamizaje?: string | null;
  alertas_pendientes?: number | null;
}

export const TESH_CAREERS = [
  "Ing. en Sistemas Computacionales",
  "Ing. Industrial",
  "Ing. Civil",
  "Ing. Mecatrónica",
  "Lic. en Administración",
  "Lic. en Biología",
  "Lic. en Gastronomía",
] as const;

const LEVEL_ORDER: Record<string, number> = {
  rojo: 1,
  amarillo: 2,
  verde: 3,
};

type SortColumn = "nivel" | "fecha" | "nombre";
type SortDirection = "asc" | "desc";

function formatFechaTamizaje(fechaStr?: string | null): string {
  if (!fechaStr) return "Sin registro";
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return format(d, "dd MMM yyyy", { locale: es });
  } catch {
    return "Sin registro";
  }
}

function parseSpanishShortDate(raw?: string): string {
  if (!raw) return new Date().toISOString();
  const months: Record<string, string> = {
    ene: "01",
    feb: "02",
    mar: "03",
    abr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    ago: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dic: "12",
  };
  const match = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = months[match[2]] || "09";
    const year = match[3];
    return `${year}-${month}-${day}T12:00:00.000Z`;
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function mockCaseToPaciente(c: CaseSummary): PacienteParaPsicologo {
  const semestreNum = c.semester ? parseInt(c.semester.replace(/[^0-9]/g, ""), 10) || 5 : 5;
  const isRed = c.riskLevel === "rojo";
  const isYellow = c.riskLevel === "amarillo";
  const eqSuffix = c.matricula
    ? c.matricula
        .replace(/[^0-9]/g, "")
        .slice(-4)
        .padStart(4, "0")
    : c.id
        .replace(/[^a-z0-9]/gi, "")
        .toUpperCase()
        .slice(-4)
        .padStart(4, "0");

  return {
    folio: `EQ-${eqSuffix}`,
    iniciales: c.initials,
    nombre: c.studentName || `Estudiante ${c.initials}`,
    matricula: c.matricula || "Matrícula reservada",
    modo_acompanamiento: c.modo_acompanamiento ?? true,
    caseId: c.id,
    edad: 21,
    sexo: "Estudiante",
    semestre: `${semestreNum}º Semestre`,
    carrera: c.career || "Ing. en Sistemas Computacionales",
    grupo: "501",
    ultimo_nivel: c.riskLevel,
    gad7_total: c.gad7 ?? (isRed ? 14 : isYellow ? 8 : 3),
    phq9_total: c.phq9 ?? (isRed ? 16 : isYellow ? 7 : 2),
    item9: isRed ? 1 : 0,
    bloqueado: c.bloqueado ?? (isRed && c.status !== "atendido"),
    tiene_alerta_activa: isRed && c.status !== "atendido",
    ultimo_tamizaje: parseSpanishShortDate(c.lastCheckIn),
    alertas_pendientes: isRed && c.status !== "atendido" ? 1 : 0,
  };
}

function getCleanInitials(raw?: string | null, nombre?: string | null): string {
  if (raw && raw.trim()) {
    return raw.replace(/\./g, "").trim().slice(0, 2).toUpperCase();
  }
  if (nombre && nombre.trim()) {
    return nombre
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return "ES";
}

function renderRiskPill(nivelLower: string) {
  if (nivelLower === "rojo") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C8102E] px-2.5 py-1 text-xs font-semibold text-white">
        <AlertTriangle className="size-3.5" />
        <span>ROJO</span>
      </span>
    );
  }
  if (nivelLower === "amarillo") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B8860B] px-2.5 py-1 text-xs font-semibold text-white">
        <Clock className="size-3.5" />
        <span>AMARILLO</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F4D2C] px-2.5 py-1 text-xs font-semibold text-white">
      <Check className="size-3.5" />
      <span>VERDE</span>
    </span>
  );
}

export function SemaforoPacientes() {
  const [pacientes, setPacientes] = useState<PacienteParaPsicologo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [nivelFilter, setNivelFilter] = useState<"todos" | "rojo" | "amarillo" | "verde">("todos");
  const [carreraFilter, setCarreraFilter] = useState<string>("todas");

  const [sortBy, setSortBy] = useState<SortColumn>("nivel");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const [pacienteALiberar, setPacienteALiberar] = useState<PacienteParaPsicologo | null>(null);
  const [isLiberando, setIsLiberando] = useState<boolean>(false);

  const [pacienteParaNotas, setPacienteParaNotas] = useState<PacienteParaPsicologo | null>(null);
  const [pacienteParaExpediente, setPacienteParaExpediente] =
    useState<PacienteParaPsicologo | null>(null);
  const [pacienteParaContacto, setPacienteParaContacto] = useState<PacienteParaPsicologo | null>(
    null,
  );

  const contactCaseItem: CaseSummary | null = useMemo(() => {
    if (!pacienteParaContacto) return null;
    const nivel = (pacienteParaContacto.ultimo_nivel?.toLowerCase() || "amarillo") as RiskLevel;
    return {
      id: pacienteParaContacto.caseId || pacienteParaContacto.folio,
      initials: pacienteParaContacto.iniciales || pacienteParaContacto.folio,
      studentName:
        pacienteParaContacto.nombre || `Estudiante ${pacienteParaContacto.iniciales || ""}`.trim(),
      matricula: pacienteParaContacto.matricula || "",
      career: pacienteParaContacto.carrera || "",
      semester: String(pacienteParaContacto.semestre || ""),
      riskLevel: nivel,
      summary: `Tamizaje GAD-7: ${pacienteParaContacto.gad7_total ?? 0} pts, PHQ-9: ${pacienteParaContacto.phq9_total ?? 0} pts`,
      lastCheckIn: pacienteParaContacto.ultimo_tamizaje || new Date().toISOString(),
      accompanimentSummary: pacienteParaContacto.modo_acompanamiento ? "Activo" : "Privado",
      phq9: pacienteParaContacto.phq9_total ?? 0,
      gad7: pacienteParaContacto.gad7_total ?? 0,
    };
  }, [pacienteParaContacto]);

  const fetchPacientes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("para_psicologo")
        .select("*")
        .order("ultimo_nivel");

      if (error || !Array.isArray(data) || data.length === 0) {
        const mockCases = getPsychologistCases();
        setPacientes(mockCases.map(mockCaseToPaciente));
        return;
      }

      setPacientes((data as PacienteParaPsicologo[]) || []);
    } catch {
      const mockCases = getPsychologistCases();
      setPacientes(mockCases.map(mockCaseToPaciente));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacientes();
  }, [fetchPacientes]);

  const handleSortToggle = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "fecha" ? "desc" : "asc");
    }
  };

  // Ordenamiento con prioridad clínica por defecto: ROJO -> AMARILLO -> VERDE
  const pacientesOrdenados = useMemo(() => {
    const dirFactor = sortDir === "asc" ? 1 : -1;
    return [...pacientes].sort((a, b) => {
      if (sortBy === "nivel") {
        const orderA = LEVEL_ORDER[a.ultimo_nivel?.toLowerCase() || ""] ?? 4;
        const orderB = LEVEL_ORDER[b.ultimo_nivel?.toLowerCase() || ""] ?? 4;
        if (orderA !== orderB) {
          return (orderA - orderB) * dirFactor;
        }
        const alertasA = a.alertas_pendientes ?? 0;
        const alertasB = b.alertas_pendientes ?? 0;
        if (alertasA !== alertasB) {
          return alertasB - alertasA;
        }
        const timeA = a.ultimo_tamizaje ? new Date(a.ultimo_tamizaje).getTime() : 0;
        const timeB = b.ultimo_tamizaje ? new Date(b.ultimo_tamizaje).getTime() : 0;
        return timeB - timeA;
      }

      if (sortBy === "fecha") {
        const timeA = a.ultimo_tamizaje ? new Date(a.ultimo_tamizaje).getTime() : 0;
        const timeB = b.ultimo_tamizaje ? new Date(b.ultimo_tamizaje).getTime() : 0;
        if (timeA !== timeB) {
          return (timeA - timeB) * dirFactor;
        }
        const orderA = LEVEL_ORDER[a.ultimo_nivel?.toLowerCase() || ""] ?? 4;
        const orderB = LEVEL_ORDER[b.ultimo_nivel?.toLowerCase() || ""] ?? 4;
        return orderA - orderB;
      }

      // Ordenar por nombre
      const nameA = (a.nombre || a.iniciales || a.folio || "").toLowerCase();
      const nameB = (b.nombre || b.iniciales || b.folio || "").toLowerCase();
      return nameA.localeCompare(nameB, "es") * dirFactor;
    });
  }, [pacientes, sortBy, sortDir]);

  const pacientesFiltrados = useMemo(() => {
    return pacientesOrdenados.filter((p) => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesFolio = (p.folio || "").toLowerCase().includes(q);
        const matchesIniciales = (p.iniciales || "").toLowerCase().includes(q);
        const matchesNombre = (p.nombre || "").toLowerCase().includes(q);
        const matchesMatricula = (p.matricula || "").toLowerCase().includes(q);
        if (!matchesFolio && !matchesIniciales && !matchesNombre && !matchesMatricula) {
          return false;
        }
      }

      if (nivelFilter !== "todos") {
        if ((p.ultimo_nivel || "").toLowerCase() !== nivelFilter) {
          return false;
        }
      }

      if (carreraFilter !== "todas") {
        if (p.carrera !== carreraFilter) {
          return false;
        }
      }

      return true;
    });
  }, [pacientesOrdenados, searchTerm, nivelFilter, carreraFilter]);

  const handleConfirmLiberar = async () => {
    if (!pacienteALiberar) return;

    try {
      setIsLiberando(true);
      let rpcSucceeded = false;

      try {
        const { data, error } = await supabase.rpc("liberar_paciente", {
          p_folio: pacienteALiberar.folio,
        });
        if (!error && data === true) {
          rpcSucceeded = true;
        }
      } catch {
        // Fallback local si no hay sesión RPC o caso demo
      }

      if (!rpcSucceeded && pacienteALiberar.caseId) {
        updateCaseStatus(pacienteALiberar.caseId, "atendido");
      }

      setPacientes((prev) =>
        prev.map((item) =>
          item.folio === pacienteALiberar.folio
            ? {
                ...item,
                bloqueado: false,
                tiene_alerta_activa: false,
                alertas_pendientes: 0,
              }
            : item,
        ),
      );

      toast.success(
        `Paciente ${pacienteALiberar.nombre || pacienteALiberar.iniciales} atendido y liberado.`,
      );
      setPacienteALiberar(null);
    } catch {
      toast.error("No se pudo liberar. Verifica permisos clínicos.");
    } finally {
      setIsLiberando(false);
    }
  };

  const conteoPorNivel = useMemo(() => {
    const rojos = pacientes.filter((p) => p.ultimo_nivel?.toLowerCase() === "rojo").length;
    const amarillos = pacientes.filter((p) => p.ultimo_nivel?.toLowerCase() === "amarillo").length;
    const verdes = pacientes.filter((p) => p.ultimo_nivel?.toLowerCase() === "verde").length;
    return { rojos, amarillos, verdes, total: pacientes.length };
  }, [pacientes]);

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortBy !== col) {
      return <ArrowUpDown className="size-3.5 text-[#6B6B6B] dark:text-[#A6B5A3]" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
    ) : (
      <ArrowDown className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <section className="space-y-4 rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        {/* Encabezado Semáforo de pacientes + Tooltip de criterios */}
        <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
                Semáforo de pacientes
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Criterios clínicos del semáforo de pacientes"
                    className="inline-flex size-6 items-center justify-center rounded-full border border-[#E5DFD3] bg-[#F5F1E8] text-[#1F4D2C] transition-colors hover:bg-[#E5DFD3]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5] dark:hover:bg-[#2D3F2A]/60"
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="max-w-xs border border-[#E5DFD3] bg-[#0F1A12] p-3 text-xs leading-relaxed text-[#F5F1E8] dark:border-[#2D3F2A]"
                >
                  <p className="font-semibold text-[#D4A82B] mb-1.5">
                    Criterios clínicos de triaje (PHQ-9 / GAD-7)
                  </p>
                  <ul className="space-y-1">
                    <li>
                      <strong className="text-[#FEE2E2]">ROJO (SLA 2h):</strong> PHQ-9 ≥ 15, GAD-7 ≥
                      15 o Ítem 9 ≥ 1. Bloqueo preventivo automático.
                    </li>
                    <li>
                      <strong className="text-[#F5C7A8]">AMARILLO:</strong> PHQ-9 10–14 o GAD-7
                      10–14. Seguimiento clínico programado.
                    </li>
                    <li>
                      <strong className="text-[#8FC9B5]">VERDE:</strong> PHQ-9 &lt; 10 y GAD-7 &lt;
                      10 (Ítem 9 = 0). Monitoreo regular.
                    </li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mt-0.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Priorización clínica ROJO → AMARILLO → VERDE. Tamizaje orientativo, no diagnóstico.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchPacientes}
            disabled={isLoading}
            className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8] dark:hover:bg-[#2D3F2A]/50"
          >
            <RefreshCw className={`mr-1.5 size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </Button>
        </div>

        {/* Filtros sobrios */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6B6B6B] dark:text-[#A6B5A3]" />
            <Input
              type="search"
              placeholder="Buscar por nombre, matrícula o folio EQ-XXXX..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 rounded-lg border-[#E5DFD3] bg-white pl-9 text-xs sm:text-sm text-[#1A1A1A] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
              aria-label="Buscar pacientes"
            />
          </div>

          <div className="md:col-span-4 flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-1 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
            {(
              [
                { id: "todos", label: `Todos (${conteoPorNivel.total})` },
                { id: "rojo", label: `Rojo (${conteoPorNivel.rojos})` },
                { id: "amarillo", label: `Amarillo (${conteoPorNivel.amarillos})` },
                { id: "verde", label: `Verde (${conteoPorNivel.verdes})` },
              ] as const
            ).map((tab) => {
              const active = nivelFilter === tab.id;
              const activeStyles =
                tab.id === "rojo"
                  ? "bg-[#C8102E] text-white"
                  : tab.id === "amarillo"
                    ? "bg-[#B8860B] text-white"
                    : tab.id === "verde"
                      ? "bg-[#1F4D2C] text-white"
                      : "bg-white text-[#1A1A1A] shadow-2xs dark:bg-[#1A2618] dark:text-[#F5F1E8]";
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNivelFilter(tab.id)}
                  className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? activeStyles
                      : "text-[#6B6B6B] hover:text-[#1A1A1A] dark:text-[#A6B5A3] dark:hover:text-[#F5F1E8]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="md:col-span-3">
            <Select value={carreraFilter} onValueChange={setCarreraFilter}>
              <SelectTrigger
                className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs text-[#1A1A1A] focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                aria-label="Filtrar por carrera"
              >
                <SelectValue placeholder="Todas las carreras" />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                <SelectItem value="todas" className="text-xs">
                  Todas las carreras (7)
                </SelectItem>
                {TESH_CAREERS.map((carrera) => (
                  <SelectItem key={carrera} value={carrera} className="text-xs">
                    {carrera}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Estado Loading */}
        {isLoading && (
          <div className="space-y-3 rounded-lg border border-[#E5DFD3] p-4 dark:border-[#2D3F2A]">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="flex items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-24 hidden md:block" />
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Estado Vacío */}
        {!isLoading && pacientesFiltrados.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#E5DFD3] bg-[#F5F1E8]/40 p-10 text-center space-y-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]/50">
            <p className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
              No hay pacientes que coincidan con los filtros aplicados
            </p>
            {(searchTerm || nivelFilter !== "todos" || carreraFilter !== "todas") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setNivelFilter("todos");
                  setCarreraFilter("todas");
                }}
                className="h-9 rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        )}

        {/* Tabla Desktop */}
        {!isLoading && pacientesFiltrados.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
              <Table>
                <TableHeader className="bg-[#F5F1E8] dark:bg-[#0F1A12]">
                  <TableRow className="border-b border-[#E5DFD3] hover:bg-transparent dark:border-[#2D3F2A]">
                    <TableHead className="py-3 pl-4">
                      <button
                        type="button"
                        onClick={() => handleSortToggle("nombre")}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F4D2C] hover:underline dark:text-[#8FC9B5]"
                      >
                        <span>Paciente</span>
                        <SortIcon col="nombre" />
                      </button>
                    </TableHead>
                    <TableHead className="py-3 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Carrera / Semestre
                    </TableHead>
                    <TableHead className="py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleSortToggle("nivel")}
                        className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#1F4D2C] hover:underline dark:text-[#8FC9B5]"
                      >
                        <span>Nivel</span>
                        <SortIcon col="nivel" />
                      </button>
                    </TableHead>
                    <TableHead className="py-3 text-center text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Tamizaje
                    </TableHead>
                    <TableHead className="py-3">
                      <button
                        type="button"
                        onClick={() => handleSortToggle("fecha")}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F4D2C] hover:underline dark:text-[#8FC9B5]"
                      >
                        <span>Fecha último tamizaje</span>
                        <SortIcon col="fecha" />
                      </button>
                    </TableHead>
                    <TableHead className="py-3 pr-4 text-right text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                  {pacientesFiltrados.map((paciente) => {
                    const nivelLower = (paciente.ultimo_nivel || "verde").toLowerCase();
                    const isRedOrBlocked = nivelLower === "rojo" || Boolean(paciente.bloqueado);
                    const avatarInitials = getCleanInitials(paciente.iniciales, paciente.nombre);
                    const displayName =
                      paciente.nombre || `Estudiante ${paciente.iniciales || "TESH"}`;
                    const displayMatricula = paciente.matricula || "Matrícula reservada";

                    return (
                      <TableRow
                        key={paciente.folio}
                        className="bg-white transition-colors hover:bg-[#F5F1E8]/50 dark:bg-[#1A2618] dark:hover:bg-[#0F1A12]/60"
                      >
                        {/* Avatar circular + Nombre + Matrícula + Folio EQ-XXXX */}
                        <TableCell className="py-3.5 pl-4">
                          <div className="flex items-center gap-3">
                            <div
                              aria-hidden="true"
                              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E5DFD3] bg-[#F5F1E8] text-xs font-bold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]"
                            >
                              {avatarInitials}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                {displayName}
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                                <span className="font-mono">{displayMatricula}</span>
                                <span>·</span>
                                <span className="font-mono font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                                  {paciente.folio}
                                </span>
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Carrera / Semestre */}
                        <TableCell className="py-3.5">
                          <div className="max-w-[210px]">
                            <p className="truncate text-xs font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                              {paciente.carrera || "TESH Huixquilucan"}
                            </p>
                            <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                              {paciente.semestre
                                ? String(paciente.semestre).includes("Semestre")
                                  ? paciente.semestre
                                  : `${paciente.semestre}º Semestre`
                                : "Semestre s/d"}
                            </p>
                          </div>
                        </TableCell>

                        {/* Pill de Nivel */}
                        <TableCell className="py-3.5 text-center">
                          {renderRiskPill(nivelLower)}
                        </TableCell>

                        {/* Puntajes */}
                        <TableCell className="py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#E5DFD3] bg-[#F5F1E8]/60 px-2.5 py-1 text-xs text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
                            <span>PHQ-9: {paciente.phq9_total ?? 0}</span>
                            <span className="text-[#6B6B6B] dark:text-[#A6B5A3]">·</span>
                            <span>GAD-7: {paciente.gad7_total ?? 0}</span>
                            {(paciente.item9 ?? 0) > 0 && (
                              <>
                                <span className="text-[#6B6B6B] dark:text-[#A6B5A3]">·</span>
                                <span className="font-bold text-[#C8102E] dark:text-[#FCA5A5]">
                                  Ít.9: {paciente.item9}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>

                        {/* Fecha último tamizaje */}
                        <TableCell className="py-3.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {formatFechaTamizaje(paciente.ultimo_tamizaje)}
                        </TableCell>

                        {/* Acciones */}
                        <TableCell className="py-3.5 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setPacienteParaNotas(paciente)}
                              title="Notas de voz del estudiante"
                              aria-label={`Notas de voz de ${displayName}`}
                              className="size-9 rounded-lg text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12] dark:hover:text-[#8FC9B5]"
                            >
                              <Mic className="size-4" />
                            </Button>

                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setPacienteParaContacto(paciente)}
                              title="Registrar llamada o contacto"
                              aria-label={`Contactar a ${displayName}`}
                              className="size-9 rounded-lg text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:bg-[#0F1A12] dark:hover:text-[#8FC9B5]"
                            >
                              <PhoneCall className="size-4" />
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setPacienteParaExpediente(paciente)}
                              className="h-9 rounded-lg px-3 text-xs font-semibold text-[#1F4D2C] hover:bg-[#1F4D2C]/10 hover:text-[#1F4D2C] dark:text-[#8FC9B5] dark:hover:bg-[#8FC9B5]/10 dark:hover:text-[#8FC9B5]"
                            >
                              <FileText className="mr-1.5 size-4" />
                              <span>Ver expediente</span>
                            </Button>

                            {isRedOrBlocked && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setPacienteALiberar(paciente)}
                                className="h-9 rounded-lg bg-[#1F4D2C] px-3 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                              >
                                <UserCheck className="mr-1.5 size-4" />
                                <span>Atendido — Liberar</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Vista Móvil */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {pacientesFiltrados.map((paciente) => {
                const nivelLower = (paciente.ultimo_nivel || "verde").toLowerCase();
                const isRedOrBlocked = nivelLower === "rojo" || Boolean(paciente.bloqueado);
                const avatarInitials = getCleanInitials(paciente.iniciales, paciente.nombre);
                const displayName = paciente.nombre || `Estudiante ${paciente.iniciales || "TESH"}`;

                return (
                  <div
                    key={paciente.folio}
                    className="rounded-lg border border-[#E5DFD3] bg-white p-4 space-y-3 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E5DFD3] bg-[#F5F1E8] text-xs font-bold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                          {avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {displayName}
                          </p>
                          <p className="font-mono text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {paciente.matricula || "Matrícula reservada"} · {paciente.folio}
                          </p>
                        </div>
                      </div>
                      {renderRiskPill(nivelLower)}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6B6B6B] border-t border-[#E5DFD3] pt-2.5 dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
                      <span>
                        PHQ-9: {paciente.phq9_total ?? 0} · GAD-7: {paciente.gad7_total ?? 0}
                      </span>
                      <span>{formatFechaTamizaje(paciente.ultimo_tamizaje)}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E5DFD3] pt-2.5 dark:border-[#2D3F2A]">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPacienteParaExpediente(paciente)}
                        className="h-9 rounded-lg text-xs font-semibold text-[#1F4D2C] hover:bg-[#1F4D2C]/10 dark:text-[#8FC9B5] dark:hover:bg-[#8FC9B5]/10"
                      >
                        <FileText className="mr-1.5 size-3.5" />
                        <span>Ver expediente</span>
                      </Button>

                      {isRedOrBlocked && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setPacienteALiberar(paciente)}
                          className="h-9 rounded-lg bg-[#1F4D2C] px-3 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                        >
                          <UserCheck className="mr-1.5 size-3.5" />
                          <span>Atendido — Liberar</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Modal de Confirmación de Liberación Clínica */}
        <Dialog
          open={Boolean(pacienteALiberar)}
          onOpenChange={(open) => {
            if (!open) setPacienteALiberar(null);
          }}
        >
          <DialogContent className="max-w-md rounded-lg border border-[#E5DFD3] bg-white p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                Confirmar atención y liberación
              </DialogTitle>
              <DialogDescription className="text-sm text-[#6B6B6B] leading-relaxed dark:text-[#A6B5A3]">
                Paciente:{" "}
                <strong className="text-[#1A1A1A] dark:text-[#F5F1E8]">
                  {pacienteALiberar?.nombre || pacienteALiberar?.iniciales}
                </strong>{" "}
                (Folio <span className="font-mono font-semibold">{pacienteALiberar?.folio}</span>).
                <br />
                Al confirmar se registrará la atención clínica y se habilitará al estudiante para
                realizar un nuevo tamizaje.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isLiberando}
                onClick={() => setPacienteALiberar(null)}
                className="h-9 rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1A1A1A] dark:border-[#2D3F2A] dark:text-[#F5F1E8]"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={isLiberando}
                onClick={handleConfirmLiberar}
                className="h-9 rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
              >
                {isLiberando ? "Liberando..." : "Atendido — Liberar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Notas de Voz */}
        <NotasVozModal
          paciente={pacienteParaNotas}
          open={Boolean(pacienteParaNotas)}
          onOpenChange={(open) => {
            if (!open) setPacienteParaNotas(null);
          }}
        />

        {/* Modal Contacto Institucional */}
        <ContactPatientDialog
          caseItem={contactCaseItem}
          isOpen={Boolean(pacienteParaContacto)}
          onOpenChange={(open) => {
            if (!open) setPacienteParaContacto(null);
          }}
          onSuccess={() => {
            fetchPacientes();
          }}
        />

        {/* Modal Expediente Clínico de 5 Páginas */}
        <Dialog
          open={Boolean(pacienteParaExpediente)}
          onOpenChange={(open) => {
            if (!open) setPacienteParaExpediente(null);
          }}
        >
          <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12] sm:p-6">
            <DialogHeader className="sr-only">
              <DialogTitle>
                Expediente Clínico de{" "}
                {pacienteParaExpediente?.nombre || pacienteParaExpediente?.iniciales}
              </DialogTitle>
              <DialogDescription>Expediente clínico institucional de 5 páginas</DialogDescription>
            </DialogHeader>
            {pacienteParaExpediente && (
              <ExpedienteClinico
                folio={pacienteParaExpediente.folio}
                onClose={() => setPacienteParaExpediente(null)}
                onPacienteLiberado={() => {
                  fetchPacientes();
                  setPacienteParaExpediente(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </section>
    </TooltipProvider>
  );
}
