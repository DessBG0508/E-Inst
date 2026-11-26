import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TESH_CAREERS } from "@/lib/directivo-data";
import {
  getCanalizaciones,
  TESH_PERIODOS_SUGERIDOS,
  type CanalizacionEstado,
  type CanalizacionPrioridad,
  type CanalizacionRecord,
} from "@/features/tutor/tutor-service";

function inferPeriodoFromDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return "2026-2";
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${month <= 6 ? "1" : "2"}`;
}

function getEstadoBadgeStyle(estado: CanalizacionEstado): {
  label: string;
  className: string;
} {
  switch (estado) {
    case "pendiente":
      return {
        label: "Pendiente",
        className: "bg-[#B8860B] text-white",
      };
    case "aceptada":
      return {
        label: "Aceptada",
        className: "bg-[#1F4D2C] text-white",
      };
    case "rechazada":
      return {
        label: "Rechazada",
        className: "bg-[#C8102E] text-white",
      };
    case "completada":
      return {
        label: "Completada",
        className: "bg-[#8FC9B5] text-[#0F1A12]",
      };
    default:
      return {
        label: estado,
        className: "bg-[#E5DFD3] text-[#1A1A1A]",
      };
  }
}

function getPrioridadLabel(prioridad: CanalizacionPrioridad): string {
  switch (prioridad) {
    case "urgente":
      return "Urgente";
    case "alta":
      return "Alta";
    case "normal":
      return "Media";
    case "baja":
      return "Baja";
    default:
      return prioridad;
  }
}

export function JefaturaCanalizacionesView() {
  const [records, setRecords] = useState<CanalizacionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [careerFilter, setCareerFilter] = useState<string>("all");
  const [periodoFilter, setPeriodoFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const list = await getCanalizaciones();
        if (active) setRecords(list);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const availableCareers = useMemo(() => {
    const set = new Set<string>([...TESH_CAREERS]);
    records.forEach((r) => {
      if (r.carrera?.trim()) set.add(r.carrera.trim());
    });
    return Array.from(set);
  }, [records]);

  const enrichedRows = useMemo(() => {
    return records.map((rec, index) => {
      const periodo = inferPeriodoFromDate(rec.created_at);
      const fecha = new Date(rec.created_at);
      const fechaLabel = isNaN(fecha.getTime())
        ? rec.created_at.slice(0, 10)
        : fecha.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

      return {
        id: rec.id,
        codigoAdmin: `CAN-${String(index + 1).padStart(3, "0")}`,
        periodo,
        carrera: rec.carrera || "Sin carrera especificada",
        semestre: rec.semestre || "-",
        grupo: rec.grupo || "-",
        tutorNombre: rec.tutor_nombre || "Tutor académico TESH",
        estudianteNombre: rec.estudiante_nombre || rec.estudiante_iniciales || "Estudiante TESH",
        motivo: rec.motivo,
        prioridad: rec.prioridad,
        estado: rec.estado,
        fechaLabel,
      };
    });
  }, [records]);

  const filteredRows = useMemo(() => {
    return enrichedRows.filter((row) => {
      if (careerFilter !== "all" && row.carrera !== careerFilter) return false;
      if (periodoFilter !== "all" && row.periodo !== periodoFilter) return false;
      if (estadoFilter !== "all" && row.estado !== estadoFilter) return false;
      return true;
    });
  }, [enrichedRows, careerFilter, periodoFilter, estadoFilter]);

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      toast.info("No hay canalizaciones en el filtro actual para exportar.");
      return;
    }

    const exportData = filteredRows.map((row) => ({
      Referencia: row.codigoAdmin,
      Periodo: row.periodo,
      Carrera: row.carrera,
      Semestre: row.semestre,
      Grupo: row.grupo,
      "Tutor Solicitante": row.tutorNombre,
      Prioridad: getPrioridadLabel(row.prioridad),
      Estado: getEstadoBadgeStyle(row.estado).label,
      "Fecha Registro": row.fechaLabel,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Canalizaciones TESH");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Equilibra_TESH_Jefatura_Canalizaciones_${stamp}.xlsx`);
    toast.success(`Archivo Excel generado con ${filteredRows.length} canalizaciones.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
            Canalizaciones del sistema
          </h2>
          <p className="mt-0.5 text-xs font-medium text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
            Seguimiento operativo de todas las canalizaciones emitidas por tutores en todas las
            carreras del TESH.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleExportExcel}
          className="h-9 shrink-0 whitespace-nowrap rounded-lg bg-[#B8860B] px-4 text-xs font-semibold text-white hover:bg-[#D4A82B]"
        >
          <FileSpreadsheet className="mr-1.5 size-4" />
          Exportar a Excel
        </Button>
      </div>

      {/* Filtros */}
      <section
        aria-label="Filtros de canalizaciones"
        className="grid grid-cols-1 gap-3 rounded-lg border border-[#E5DFD3] bg-white p-4 sm:grid-cols-3 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
      >
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
            Carrera
          </span>
          <Select value={careerFilter} onValueChange={setCareerFilter}>
            <SelectTrigger
              aria-label="Filtrar canalizaciones por carrera"
              className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
            >
              <SelectValue placeholder="Todas las carreras" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
              <SelectItem value="all" className="text-xs font-semibold">
                Todas las carreras
              </SelectItem>
              {availableCareers.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
            Periodo
          </span>
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger
              aria-label="Filtrar canalizaciones por periodo"
              className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
            >
              <SelectValue placeholder="Todos los periodos" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
              <SelectItem value="all" className="text-xs font-semibold">
                Todos los periodos
              </SelectItem>
              {TESH_PERIODOS_SUGERIDOS.map((per) => (
                <SelectItem key={per} value={per} className="text-xs">
                  Periodo {per}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
            Estado
          </span>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger
              aria-label="Filtrar canalizaciones por estado"
              className="h-9 rounded-lg border-[#E5DFD3] bg-white text-xs dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
            >
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
              <SelectItem value="all" className="text-xs font-semibold">
                Todos los estados
              </SelectItem>
              <SelectItem value="pendiente" className="text-xs">
                Pendiente
              </SelectItem>
              <SelectItem value="aceptada" className="text-xs">
                Aceptada
              </SelectItem>
              <SelectItem value="rechazada" className="text-xs">
                Rechazada
              </SelectItem>
              <SelectItem value="completada" className="text-xs">
                Completada
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Tabla */}
      <div className="rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div className="flex items-center justify-between border-b border-[#E5DFD3] px-4 py-3 text-xs dark:border-[#2D3F2A]">
          <span className="font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
            Canalizaciones registradas ({filteredRows.length})
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[#1F4D2C] dark:text-[#8FC9B5]">
            <ShieldCheck className="size-3.5" />
            Sin expedientes clínicos expuestos
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#6B6B6B]">
            <Loader2 className="size-4 animate-spin text-[#1F4D2C]" />
            <span>Cargando canalizaciones del sistema...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Referencia
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Periodo
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Carrera / Semestre / Grupo
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Tutor solicitante
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Prioridad
                  </th>
                  <th className="px-4 py-3 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[#6B6B6B]">
                      No hay canalizaciones registradas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const badge = getEstadoBadgeStyle(row.estado);
                    return (
                      <tr key={row.id} className="hover:bg-[#F5F1E8]/60 dark:hover:bg-[#0F1A12]/40">
                        <td className="px-4 py-3 font-bold text-[#1A1A1A] tabular-nums dark:text-[#F5F1E8]">
                          {row.codigoAdmin}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                          {row.periodo}
                        </td>
                        <td className="px-4 py-3 text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {row.carrera} · {row.semestre}º Grupo {row.grupo}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {row.tutorNombre}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                          {getPrioridadLabel(row.prioridad)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#6B6B6B] tabular-nums dark:text-[#A6B5A3]">
                          {row.fechaLabel}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
