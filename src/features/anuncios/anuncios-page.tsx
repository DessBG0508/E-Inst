import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Calendar, CheckCircle2, MapPin, Megaphone, Search, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { AnuncioDetailModal } from "./anuncio-detail-modal";
import { AnuncioFlyerPreview } from "./anuncio-flyer-preview";
import {
  cancelarInscripcionAnuncio,
  fetchAnuncios,
  fetchMisInscripciones,
  inscribirseAnuncio,
} from "./anuncios-service";
import {
  ANUNCIO_TIPO_META,
  cleanAnuncioTitle,
  formatFechaMx,
  type AnuncioItem,
  type AnuncioTipo,
} from "./types";

type AnuncioFilterTab = "todos" | AnuncioTipo | "mis_inscripciones";

const FILTER_TABS: Array<{ id: AnuncioFilterTab; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "taller", label: "Talleres" },
  { id: "evento", label: "Eventos" },
  { id: "informativo", label: "Informativos" },
  { id: "recordatorio", label: "Recordatorios" },
  { id: "mis_inscripciones", label: "Mis inscripciones" },
];

interface AnunciosPageProps {
  initialAnuncioId?: string;
}

export function AnunciosPage({ initialAnuncioId }: AnunciosPageProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
  const [misInscripciones, setMisInscripciones] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<AnuncioFilterTab>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnuncio, setSelectedAnuncio] = useState<AnuncioItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [list, inscripciones] = await Promise.all([
          fetchAnuncios({ includeInactive: false }),
          fetchMisInscripciones(user?.id),
        ]);
        if (!active) return;
        setAnuncios(list);
        setMisInscripciones(inscripciones);

        if (initialAnuncioId) {
          const found = list.find((item) => item.id === initialAnuncioId);
          if (found) setSelectedAnuncio(found);
        }
      } catch {
        if (active) {
          toast.error("No se pudieron cargar los anuncios y talleres.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [user?.id, initialAnuncioId]);

  const filteredAnuncios = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return anuncios.filter((item) => {
      if (activeFilter === "mis_inscripciones") {
        if (!misInscripciones.includes(item.id)) return false;
      } else if (activeFilter !== "todos") {
        if (item.tipo !== activeFilter) return false;
      }

      if (q) {
        const title = cleanAnuncioTitle(item.titulo).toLowerCase();
        const desc = item.descripcion.toLowerCase();
        if (!title.includes(q) && !desc.includes(q)) return false;
      }

      return true;
    });
  }, [anuncios, activeFilter, misInscripciones, searchQuery]);

  const handleInscribirme = async (anuncio: AnuncioItem) => {
    setIsSubmitting(true);
    try {
      const { inscritos } = await inscribirseAnuncio(anuncio.id, user?.id);
      setMisInscripciones((prev) => (prev.includes(anuncio.id) ? prev : [...prev, anuncio.id]));
      setAnuncios((prev) =>
        prev.map((item) => (item.id === anuncio.id ? { ...item, inscritos } : item)),
      );
      setSelectedAnuncio((prev) =>
        prev && prev.id === anuncio.id ? { ...prev, inscritos } : prev,
      );
      toast.success("Inscripción confirmada.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar tu inscripción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelarInscripcion = async (anuncio: AnuncioItem) => {
    setIsSubmitting(true);
    try {
      const { inscritos } = await cancelarInscripcionAnuncio(anuncio.id, user?.id);
      setMisInscripciones((prev) => prev.filter((id) => id !== anuncio.id));
      setAnuncios((prev) =>
        prev.map((item) => (item.id === anuncio.id ? { ...item, inscritos } : item)),
      );
      setSelectedAnuncio((prev) =>
        prev && prev.id === anuncio.id ? { ...prev, inscritos } : prev,
      );
      toast.info("Has cancelado tu inscripción.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar tu inscripción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const breadcrumbs: InstitutionalBreadcrumbItem[] = [
    { label: "Bienestar Estudiantil", href: "/" },
    { label: "Anuncios y Talleres" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] font-sans text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <InstitutionalHeader
        moduleTitle="Anuncios y Talleres"
        breadcrumbs={breadcrumbs}
        onHomeClick={() => navigate({ to: "/" })}
        showCrisisButton={true}
        onCrisisClick={() => navigate({ to: "/alerta" })}
        actions={
          <>
            <AjustesModal
              rol={user?.role || "estudiante"}
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
            <ThemeToggle className="size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white" />
          </>
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-[#E5DFD3] pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-[#2D3F2A]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1F4D2C] dark:text-[#8FC9B5]">
              Convocatorias y actividades TESH
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1A1A1A] dark:text-[#F5F1E8]">
              Anuncios, talleres y eventos
            </h2>
            <p className="mt-1 text-sm text-[#6B6B6B] dark:text-[#A8B5A0]">
              Explora los talleres psicoeducativos, jornadas y recordatorios disponibles para tu
              bienestar universitario.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6B6B6B] dark:text-[#A8B5A0]" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título..."
              aria-label="Buscar anuncios por título"
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtros por categoría */}
        <div
          role="tablist"
          aria-label="Filtrar anuncios por categoría"
          className="flex flex-wrap items-center gap-2"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            const count = tab.id === "mis_inscripciones" ? misInscripciones.length : undefined;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(tab.id)}
                className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
                    : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:hover:bg-[#223120]"
                }`}
              >
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      isActive ? "bg-white/20 text-white" : "bg-[#1F4D2C] text-white"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Grid de tarjetas */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-80 animate-pulse rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]"
              />
            ))}
          </div>
        ) : filteredAnuncios.length === 0 ? (
          <div className="rounded-lg border border-[#E5DFD3] bg-white p-10 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
            <Megaphone className="mx-auto size-8 text-[#6B6B6B] dark:text-[#A8B5A0]" />
            <h3 className="mt-3 text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
              No se encontraron anuncios con este filtro
            </h3>
            <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
              Prueba otra categoría o limpia el campo de búsqueda.
            </p>
            {(activeFilter !== "todos" || searchQuery) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveFilter("todos");
                  setSearchQuery("");
                }}
                className="mt-4"
              >
                Mostrar todos
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAnuncios.map((item) => {
              const meta = ANUNCIO_TIPO_META[item.tipo] || ANUNCIO_TIPO_META.taller;
              const cleanTitle = cleanAnuncioTitle(item.titulo);
              const isInscrito = misInscripciones.includes(item.id);
              const hasCupo = typeof item.cupo === "number" && item.cupo > 0;
              const cupoLleno = hasCupo && item.inscritos >= Number(item.cupo);

              return (
                <article
                  key={item.id}
                  onClick={() => setSelectedAnuncio(item)}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-[#E5DFD3] bg-white transition-colors hover:border-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:hover:border-[#4A7C59]"
                >
                  <AnuncioFlyerPreview
                    imagenUrl={item.imagen_url}
                    titulo={cleanTitle}
                    tipo={item.tipo}
                    className="h-44 w-full"
                  />

                  <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge className={meta.badgeClassName}>{meta.label}</Badge>
                        {isInscrito && (
                          <Badge variant="primary" className="gap-1">
                            <CheckCircle2 className="size-3" />
                            Inscrito
                          </Badge>
                        )}
                        {!isInscrito && cupoLleno && <Badge variant="danger">Cupo lleno</Badge>}
                      </div>

                      <h3 className="text-base font-bold leading-snug text-[#1A1A1A] group-hover:text-[#1F4D2C] dark:text-[#F5F1E8] dark:group-hover:text-[#8FC9B5]">
                        {cleanTitle}
                      </h3>

                      <p className="line-clamp-2 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A8B5A0]">
                        {item.descripcion}
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-[#E5DFD3] pt-3 text-xs text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A8B5A0]">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                        <span className="truncate">{formatFechaMx(item.fecha_evento)}</span>
                      </p>
                      {item.lugar && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                          <span className="truncate">{item.lugar}</span>
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
                          <Users className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                          {hasCupo ? `${item.inscritos}/${item.cupo}` : "Acceso abierto"}
                        </span>
                        <span className="font-semibold text-[#1F4D2C] group-hover:underline dark:text-[#8FC9B5]">
                          Ver detalle
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <AnuncioDetailModal
        anuncio={selectedAnuncio}
        isOpen={Boolean(selectedAnuncio)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAnuncio(null);
            if (initialAnuncioId) {
              navigate({ to: "/anuncios", search: {} });
            }
          }
        }}
        isInscrito={selectedAnuncio ? misInscripciones.includes(selectedAnuncio.id) : false}
        isSubmitting={isSubmitting}
        onInscribirme={handleInscribirme}
        onCancelarInscripcion={handleCancelarInscripcion}
      />
    </div>
  );
}
