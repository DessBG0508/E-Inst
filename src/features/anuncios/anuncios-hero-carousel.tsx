import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchAnuncios } from "./anuncios-service";
import { AnuncioFlyerPreview } from "./anuncio-flyer-preview";
import { ANUNCIO_TIPO_META, cleanAnuncioTitle, formatFechaMx, type AnuncioItem } from "./types";

const ROTATION_INTERVAL_MS = 5000;

export function AnunciosHeroCarousel() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAnuncios({ includeInactive: false })
      .then((list) => {
        if (active) {
          setAnuncios(list);
          setActiveIndex(0);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (anuncios.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % anuncios.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [anuncios.length, isPaused]);

  if (anuncios.length === 0) return null;

  const safeIndex = activeIndex % anuncios.length;
  const current = anuncios[safeIndex];
  const meta = ANUNCIO_TIPO_META[current.tipo] || ANUNCIO_TIPO_META.taller;
  const cleanTitle = cleanAnuncioTitle(current.titulo);

  const cupoTexto =
    typeof current.cupo === "number" && current.cupo > 0
      ? `${current.inscritos}/${current.cupo} lugares`
      : "Acceso abierto";

  const goToPrev = () => {
    setActiveIndex((prev) => (prev - 1 + anuncios.length) % anuncios.length);
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev + 1) % anuncios.length);
  };

  return (
    <section
      aria-label="Anuncios y talleres institucionales"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="relative mb-6 overflow-hidden rounded-lg border border-[#E5DFD3] bg-white shadow-sm dark:border-[#2D3F2A] dark:bg-[#1A2618]"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -18 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]"
        >
          {/* Flyer del anuncio */}
          <AnuncioFlyerPreview
            imagenUrl={current.imagen_url}
            titulo={cleanTitle}
            tipo={current.tipo}
            className="h-44 w-full md:h-full md:min-h-[196px]"
          />

          {/* Detalle e inscripción */}
          <div className="flex flex-col justify-between gap-4 p-5 sm:p-6">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge className={meta.badgeClassName}>{meta.label}</Badge>

                {anuncios.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={goToPrev}
                      aria-label="Anuncio anterior"
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5DFD3] bg-white text-[#1F4D2C] transition-colors hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="min-w-10 text-center font-mono text-xs tabular-nums text-[#6B6B6B] dark:text-[#A8B5A0]">
                      {safeIndex + 1}/{anuncios.length}
                    </span>
                    <button
                      type="button"
                      onClick={goToNext}
                      aria-label="Siguiente anuncio"
                      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5DFD3] bg-white text-[#1F4D2C] transition-colors hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                )}
              </div>

              <h2 className="text-lg font-bold leading-snug text-[#1A1A1A] sm:text-xl dark:text-[#F5F1E8]">
                {cleanTitle}
              </h2>

              <p className="line-clamp-2 text-xs leading-relaxed text-[#6B6B6B] sm:text-sm dark:text-[#A8B5A0]">
                {current.descripcion}
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#E5DFD3] pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-[#6B6B6B] dark:text-[#A8B5A0]">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                  {formatFechaMx(current.fecha_evento)}
                </span>
                {current.lugar && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    {current.lugar}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                  <Users className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                  {cupoTexto}
                </span>
              </div>

              <Button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/anuncios",
                    search: { anuncio: current.id },
                  })
                }
                className="h-10 shrink-0"
              >
                <span>Ir a inscribirme</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Barra de progreso inferior por color de categoría */}
      <div className="h-1 w-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
        {anuncios.length > 1 && !isPaused && !shouldReduceMotion ? (
          <motion.div
            key={`${current.id}-${safeIndex}`}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: ROTATION_INTERVAL_MS / 1000, ease: "linear" }}
            className="h-full"
            style={{ backgroundColor: meta.hexColor }}
          />
        ) : (
          <div className="h-full w-full" style={{ backgroundColor: meta.hexColor }} />
        )}
      </div>
    </section>
  );
}
