import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  MapPin,
  UserCheck,
  Users,
} from "lucide-react";
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
import { AnuncioFlyerPreview } from "./anuncio-flyer-preview";
import { ANUNCIO_TIPO_META, cleanAnuncioTitle, formatFechaMx, type AnuncioItem } from "./types";

interface AnuncioDetailModalProps {
  anuncio: AnuncioItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isInscrito: boolean;
  isSubmitting?: boolean;
  onInscribirme?: (anuncio: AnuncioItem) => Promise<void> | void;
  onCancelarInscripcion?: (anuncio: AnuncioItem) => Promise<void> | void;
  readOnlyPreview?: boolean;
}

export function AnuncioDetailModal({
  anuncio,
  isOpen,
  onOpenChange,
  isInscrito,
  isSubmitting = false,
  onInscribirme,
  onCancelarInscripcion,
  readOnlyPreview = false,
}: AnuncioDetailModalProps) {
  const [showTemario, setShowTemario] = useState(false);

  useEffect(() => {
    setShowTemario(false);
  }, [anuncio?.id, isOpen]);

  if (!anuncio) return null;

  const meta = ANUNCIO_TIPO_META[anuncio.tipo] || ANUNCIO_TIPO_META.taller;
  const cleanTitle = cleanAnuncioTitle(anuncio.titulo);

  const hasCupo = typeof anuncio.cupo === "number" && anuncio.cupo > 0;
  const inscritos = Math.max(0, anuncio.inscritos || 0);
  const cupoTotal = hasCupo ? Number(anuncio.cupo) : 0;
  const cupoPorcentaje = hasCupo ? Math.min(100, Math.round((inscritos / cupoTotal) * 100)) : 0;
  const cupoLleno = hasCupo && inscritos >= cupoTotal;

  // Barra de progreso de cupo: verde <70%, amarillo 70-90%, rojo >90%
  const progressBarColorClass =
    cupoPorcentaje > 90 ? "bg-[#C8102E]" : cupoPorcentaje >= 70 ? "bg-[#B8860B]" : "bg-[#1F4D2C]";

  const horarioText =
    anuncio.hora_inicio && anuncio.hora_fin
      ? `${anuncio.hora_inicio} – ${anuncio.hora_fin} hrs`
      : anuncio.hora_inicio
        ? `${anuncio.hora_inicio} hrs`
        : "Horario por confirmar";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-lg border border-[#E5DFD3] bg-white p-0 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
        {/* Botón Volver visible arriba a la izquierda */}
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 left-3 z-10 h-9 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] bg-white/95 px-3 text-xs font-semibold text-[#1F4D2C] shadow-sm hover:bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]/95 dark:text-[#8FC9B5]"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            <span>Volver</span>
          </Button>

          {/* Flyer arriba: 200px, ancho completo */}
          <AnuncioFlyerPreview
            imagenUrl={anuncio.imagen_url}
            titulo={cleanTitle}
            tipo={anuncio.tipo}
            className="h-[200px] w-full rounded-t-lg"
          />
        </div>

        <div className="space-y-5 p-6">
          <DialogHeader className="border-b border-[#E5DFD3] p-0 pb-4 text-left dark:border-[#2D3F2A]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={meta.badgeClassName}>{meta.label}</Badge>
              {isInscrito && (
                <Badge variant="mint" className="gap-1 bg-[#1F4D2C] text-white">
                  <CheckCircle2 className="size-3.5" />
                  Inscrito
                </Badge>
              )}
            </div>
            <DialogTitle className="pt-2 text-xl font-bold leading-snug text-[#1A1A1A] dark:text-[#F5F1E8]">
              {cleanTitle}
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-relaxed text-[#6B6B6B] dark:text-[#A8B5A0]">
              {anuncio.descripcion}
            </DialogDescription>
          </DialogHeader>

          {/* Ver temario completo expandible */}
          {anuncio.descripcion_larga && (
            <div className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
              <button
                type="button"
                onClick={() => setShowTemario((prev) => !prev)}
                aria-expanded={showTemario}
                className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                <span>Ver temario completo</span>
                {showTemario ? (
                  <ChevronUp className="size-4 shrink-0" />
                ) : (
                  <ChevronDown className="size-4 shrink-0" />
                )}
              </button>

              {showTemario && (
                <div className="mt-3 border-t border-[#E5DFD3] pt-3 text-xs leading-relaxed whitespace-pre-line text-[#1A1A1A] dark:border-[#2D3F2A] dark:text-[#F5F1E8]">
                  {anuncio.descripcion_larga}
                </div>
              )}
            </div>
          )}

          {/* Tabla info con íconos Lucide */}
          <div className="overflow-hidden rounded-lg border border-[#E5DFD3] dark:border-[#2D3F2A]">
            <table className="w-full text-left text-xs sm:text-sm">
              <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                <tr>
                  <th className="w-36 bg-[#F5F1E8]/70 px-3.5 py-2.5 font-semibold text-[#1F4D2C] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="size-4 shrink-0" strokeWidth={1.75} />
                      Fecha
                    </span>
                  </th>
                  <td className="px-3.5 py-2.5 font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {formatFechaMx(anuncio.fecha_evento)}
                  </td>
                </tr>
                <tr>
                  <th className="bg-[#F5F1E8]/70 px-3.5 py-2.5 font-semibold text-[#1F4D2C] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    <span className="inline-flex items-center gap-2">
                      <Clock className="size-4 shrink-0" strokeWidth={1.75} />
                      Hora
                    </span>
                  </th>
                  <td className="px-3.5 py-2.5 tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {horarioText}
                  </td>
                </tr>
                <tr>
                  <th className="bg-[#F5F1E8]/70 px-3.5 py-2.5 font-semibold text-[#1F4D2C] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="size-4 shrink-0" strokeWidth={1.75} />
                      Lugar
                    </span>
                  </th>
                  <td className="px-3.5 py-2.5 text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {anuncio.lugar || "Por confirmar"}
                  </td>
                </tr>
                <tr>
                  <th className="bg-[#F5F1E8]/70 px-3.5 py-2.5 font-semibold text-[#1F4D2C] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    <span className="inline-flex items-center gap-2">
                      <UserCheck className="size-4 shrink-0" strokeWidth={1.75} />
                      Ponente
                    </span>
                  </th>
                  <td className="px-3.5 py-2.5 text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {anuncio.ponente || "Área de Psicología TESH"}
                  </td>
                </tr>
                <tr>
                  <th className="bg-[#F5F1E8]/70 px-3.5 py-2.5 font-semibold text-[#1F4D2C] dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList className="size-4 shrink-0" strokeWidth={1.75} />
                      Requisitos
                    </span>
                  </th>
                  <td className="px-3.5 py-2.5 text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {anuncio.requisitos || "Sin requisitos previos."}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Barra de progreso de cupo */}
          <div className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/40 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 text-[#1A1A1A] dark:text-[#F5F1E8]">
                <Users className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" strokeWidth={1.75} />
                Cupo de participación
              </span>
              {hasCupo ? (
                <span className="font-mono tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
                  {inscritos} / {cupoTotal} lugares ({cupoPorcentaje}%)
                </span>
              ) : (
                <span className="text-[#1F4D2C] dark:text-[#8FC9B5]">Acceso abierto</span>
              )}
            </div>

            {hasCupo && (
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
                <div
                  className={`h-full transition-all duration-200 ${progressBarColorClass}`}
                  style={{ width: `${cupoPorcentaje}%` }}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11"
            >
              Cerrar
            </Button>

            {!readOnlyPreview && (
              <>
                {isInscrito ? (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={isSubmitting}
                    onClick={() => onCancelarInscripcion?.(anuncio)}
                    className="h-11"
                  >
                    {isSubmitting ? "Procesando..." : "Cancelar inscripción"}
                  </Button>
                ) : cupoLleno ? (
                  <Button type="button" disabled className="h-11 bg-[#6B6B6B] text-white">
                    Cupo lleno
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onInscribirme?.(anuncio)}
                    className="h-11"
                  >
                    {isSubmitting ? "Inscribiendo..." : "Inscribirme"}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
