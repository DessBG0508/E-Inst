import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Hand,
  Play,
  Search,
  Settings,
  Sparkles,
  Video,
  Wind,
} from "lucide-react";
import {
  InstitutionalHeader,
  type InstitutionalBreadcrumbItem,
} from "@/components/layout/institutional-header";
import { AjustesModal } from "@/components/settings/ajustes-modal";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { brandConfig } from "@/config/brand-config";
import { resourceIcons } from "@/config/icons";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/branding";
import type { CanonicalResourceCategory, PsychoResource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CANONICAL_RESOURCE_CATEGORIES,
  detectVideoOrientation,
  fetchResourcesAsync,
  getCategoryVisuals,
  getStoredResources,
  normalizeResourceCategory,
} from "./recursos-service";
import { VideoPlayerView, type ResolvedOrientation } from "./video-player-view";
import { Respiracion478Modal } from "./respiracion-478-modal";
import { Grounding54321Modal } from "./grounding-54321-modal";

const FILTER_CATEGORIES: Array<"Todos" | CanonicalResourceCategory> = [
  "Todos",
  ...CANONICAL_RESOURCE_CATEGORIES,
];

function getIconComponent(iconName: PsychoResource["iconName"]) {
  switch (iconName) {
    case "wind":
      return resourceIcons.wind;
    case "moon":
      return resourceIcons.moon;
    case "sun":
      return resourceIcons.sun;
    case "heart":
      return resourceIcons.heart;
    case "compass":
      return resourceIcons.compass;
    case "brain":
      return resourceIcons.brain;
    case "feather":
      return resourceIcons.feather;
    case "smile":
      return resourceIcons.smile;
    case "bookOpen":
    default:
      return resourceIcons.bookOpen;
  }
}

function ResourceThumbnail({ resource }: { resource: PsychoResource }) {
  const [imgFailed, setImgFailed] = useState(false);
  const visuals = getCategoryVisuals(resource.category);
  const IconComponent = getIconComponent(resource.iconName);
  const hasVideo = Boolean(resource.videoUrl);

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden border-b border-[#E5DFD3] dark:border-[#2D3F2A] ${visuals.softBgClass}`}
    >
      {resource.thumbnailUrl && !imgFailed ? (
        <img
          src={resource.thumbnailUrl}
          alt={resource.title}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `radial-gradient(${visuals.hex} 1.25px, transparent 1.25px)`,
              backgroundSize: "14px 14px",
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className="grid size-13 place-items-center rounded-xl border border-white/60 bg-white/90 shadow-xs transition-transform duration-200 group-hover:scale-105 dark:bg-[#1A2618]"
              style={{ color: visuals.hex }}
            >
              <IconComponent className="size-6" strokeWidth={1.75} />
            </div>
            <span className="rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-[#1A1A1A] dark:bg-[#0F1A12]/80 dark:text-[#F5F1E8]">
              {hasVideo ? "Video demostrativo" : "Guía práctica"}
            </span>
          </div>
        </div>
      )}

      {/* Indicador de reproducción si tiene video */}
      {hasVideo && (
        <div className="absolute right-3 bottom-3 z-10 inline-flex items-center gap-1 rounded-full bg-[#0F1A12]/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs">
          <Play className="size-3 fill-current" />
          <span>Video</span>
        </div>
      )}
    </div>
  );
}

export function RecursosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [resources, setResources] = useState<PsychoResource[]>(() => getStoredResources());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"Todos" | CanonicalResourceCategory>(
    "Todos",
  );
  const [activeResource, setActiveResource] = useState<PsychoResource | null>(null);
  const [videoOrientation, setVideoOrientation] = useState<ResolvedOrientation>("horizontal");
  const [eliFailed, setEliFailed] = useState(false);

  // Modales interactivos de ejercicios
  const [isBreathingOpen, setIsBreathingOpen] = useState(false);
  const [isGroundingOpen, setIsGroundingOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await fetchResourcesAsync();
      setResources(data);
    }
    load();
  }, []);

  useEffect(() => {
    if (activeResource?.videoUrl) {
      setVideoOrientation(
        detectVideoOrientation(activeResource.videoUrl, activeResource.videoOrientation),
      );
    } else {
      setVideoOrientation("horizontal");
    }
  }, [activeResource]);

  const handleOrientationDetected = useCallback((next: ResolvedOrientation) => {
    setVideoOrientation(next);
  }, []);

  // Solo recursos activos (visibilidad = true)
  const activeCatalog = useMemo(() => resources.filter((rec) => rec.active !== false), [resources]);

  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activeCatalog.filter((rec) => {
      const canonical = normalizeResourceCategory(rec.category);
      const matchesCategory = selectedCategory === "Todos" || canonical === selectedCategory;
      const matchesSearch =
        query === "" ||
        rec.title.toLowerCase().includes(query) ||
        rec.shortDescription.toLowerCase().includes(query) ||
        canonical.toLowerCase().includes(query) ||
        (rec.author && rec.author.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [activeCatalog, searchQuery, selectedCategory]);

  // Recursos relacionados para la barra lateral del reproductor
  const relatedResources = useMemo(() => {
    if (!activeResource) return [];
    const currentCategory = normalizeResourceCategory(activeResource.category);
    const others = activeCatalog.filter((rec) => rec.id !== activeResource.id);
    const sameCategory = others.filter(
      (rec) => normalizeResourceCategory(rec.category) === currentCategory,
    );
    const differentCategory = others.filter(
      (rec) => normalizeResourceCategory(rec.category) !== currentCategory,
    );
    return [...sameCategory, ...differentCategory].slice(0, 4);
  }, [activeCatalog, activeResource]);

  const breadcrumbs: InstitutionalBreadcrumbItem[] = activeResource
    ? [
        { label: "Bienestar Estudiantil", href: "/" },
        { label: "Recursos de bienestar", onClick: () => setActiveResource(null) },
        { label: activeResource.title },
      ]
    : [{ label: "Bienestar Estudiantil", href: "/" }, { label: "Recursos de bienestar" }];

  const handleOpenResource = (resource: PsychoResource) => {
    setActiveResource(resource);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: shouldReduceMotion ? "auto" : "smooth" });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F1E8] text-[#1A1A1A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <InstitutionalHeader
        moduleTitle="Recursos de bienestar"
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
            <ThemeToggle className="size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none backdrop-blur-none hover:scale-100 hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white" />
          </>
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {activeResource ? (
            /* VISTA REPRODUCTOR + SIDEBAR RECURSOS RELACIONADOS */
            <motion.section
              key={`player-${activeResource.id}`}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 pb-12"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DFD3] pb-4 dark:border-[#2D3F2A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveResource(null)}
                  className="h-10 cursor-pointer gap-2 rounded-lg border-[#E5DFD3] bg-white px-4 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
                >
                  <ArrowLeft className="size-4" />
                  <span>Volver a recursos</span>
                </Button>

                <div className="flex items-center gap-2">
                  {activeResource.videoUrl && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#E5DFD3] bg-white px-3 py-1 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]">
                      <Video className="size-3.5" />
                      {videoOrientation === "vertical"
                        ? "Formato vertical"
                        : videoOrientation === "square"
                          ? "Formato cuadrado"
                          : "Formato horizontal"}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      getCategoryVisuals(activeResource.category).pillClass
                    }`}
                  >
                    {getCategoryVisuals(activeResource.category).label}
                  </span>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                {/* Columna principal: Reproductor adaptativo + Contenido */}
                <div className="min-w-0 space-y-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        <Clock className="size-3.5" />
                        {activeResource.readTime}
                      </span>
                      {activeResource.author && (
                        <>
                          <span>•</span>
                          <span>{activeResource.author}</span>
                        </>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1F4D2C] sm:text-3xl dark:text-[#F5F1E8]">
                      {activeResource.title}
                    </h1>
                    <p className="text-sm leading-relaxed text-[#6B6B6B] sm:text-base dark:text-[#A6B5A3]">
                      {activeResource.shortDescription}
                    </p>
                  </div>

                  {activeResource.videoUrl && (
                    <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 shadow-xs sm:p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                          <Play className="size-3.5 fill-current" />
                          {activeResource.videoTitle || activeResource.title}
                        </span>
                      </div>

                      <VideoPlayerView
                        videoUrl={activeResource.videoUrl}
                        title={activeResource.videoTitle || activeResource.title}
                        orientation={activeResource.videoOrientation || "auto"}
                        onOrientationDetected={handleOrientationDetected}
                      />
                    </div>
                  )}

                  <div className="space-y-4 rounded-xl border border-[#E5DFD3] bg-white p-6 text-sm leading-relaxed text-[#1A1A1A] shadow-xs sm:p-7 sm:text-base dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
                    {activeResource.content.map((paragraph, index) => (
                      <p key={index} className="leading-relaxed">
                        {paragraph}
                      </p>
                    ))}

                    {activeResource.keyTakeaway && (
                      <div className="mt-4 rounded-lg border border-[#8FC9B5] bg-[#E0F0E8] p-4 dark:border-[#4A7C59] dark:bg-[#0F1A12]">
                        <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F4D2C] dark:text-[#8FC9B5]">
                          <Sparkles className="size-4" />
                          <span>Idea para recordar</span>
                        </div>
                        <p className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]">
                          {activeResource.keyTakeaway}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar: Recursos relacionados */}
                <aside aria-label="Recursos relacionados" className="space-y-4 lg:sticky lg:top-28">
                  <div className="rounded-xl border border-[#E5DFD3] bg-white p-5 shadow-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <h2 className="text-sm font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Recursos relacionados
                    </h2>
                    <p className="mt-0.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Continúa explorando técnicas y guías complementarias.
                    </p>

                    <div className="mt-4 space-y-3">
                      {relatedResources.map((rel) => {
                        const relVisuals = getCategoryVisuals(rel.category);
                        return (
                          <button
                            key={rel.id}
                            type="button"
                            onClick={() => handleOpenResource(rel)}
                            className="group flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-3 text-left transition-colors hover:border-[#1F4D2C]/50 hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12]/60 dark:hover:border-[#8FC9B5]/50"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${relVisuals.pillClass}`}
                              >
                                {relVisuals.label}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                                <Clock className="size-3" />
                                {rel.readTime}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-xs font-bold text-[#1A1A1A] group-hover:text-[#1F4D2C] dark:text-[#F5F1E8] dark:group-hover:text-[#8FC9B5]">
                              {rel.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#7B6FD8]/30 bg-[#ECE8FA] p-5 dark:bg-[#7B6FD8]/15">
                    <p className="text-xs font-bold text-[#5346B8] dark:text-[#C8C0F8]">
                      ¿Prefieres hablarlo con {BRAND.assistant}?
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                      Nuestro espacio de tamizaje y acompañamiento está disponible cuando lo
                      necesites.
                    </p>
                    <Button
                      asChild
                      className="mt-3 h-9 w-full rounded-lg bg-[#7B6FD8] text-xs font-semibold text-white hover:bg-[#695CC8]"
                    >
                      <Link to="/chat">Conversar con {BRAND.assistant}</Link>
                    </Button>
                  </div>
                </aside>
              </div>
            </motion.section>
          ) : (
            /* VISTA ESTUDIANTE PRINCIPAL: HERO + EJERCICIOS INTERACTIVOS + FILTROS + GRID */
            <motion.div
              key="resource-catalog"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              className="space-y-8 pb-12"
            >
              {/* Hero Card bg-[#ECE8FA] con mascota Eli */}
              <section className="rounded-xl border border-[#7B6FD8]/25 bg-[#ECE8FA] p-6 shadow-xs sm:p-8 dark:border-[#7B6FD8]/35 dark:bg-[#231F3A]">
                <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-2 shadow-xs sm:size-24 dark:border-[#7B6FD8]/40 dark:bg-[#1A2618]">
                      {!eliFailed ? (
                        <img
                          src={brandConfig.eliAvatarUrl}
                          alt="Mascota Eli de Equilibra TESH"
                          onError={() => setEliFailed(true)}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Sparkles className="size-10 text-[#7B6FD8]" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-0.5 text-xs font-semibold text-[#7B6FD8] dark:bg-[#1A2618] dark:text-[#C8C0F8]">
                        <BookOpen className="size-3.5" />
                        Biblioteca de bienestar TESH
                      </span>
                      <h2 className="text-2xl font-bold tracking-tight text-[#1F4D2C] sm:text-3xl dark:text-[#F5F1E8]">
                        Explora recursos para tu bienestar
                      </h2>
                      <p className="max-w-2xl text-sm leading-relaxed text-[#1A1A1A]/85 dark:text-[#E5DFD3]">
                        Videos guiados, lecturas prácticas y ejercicios interactivos diseñados junto
                        al Área de Psicología para acompañarte en tu vida universitaria.
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[#7B6FD8]/25 bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#1F4D2C] dark:bg-[#1A2618] dark:text-[#8FC9B5]">
                    <span>{activeCatalog.length} recursos activos</span>
                  </div>
                </div>
              </section>

              {/* Sección de 2 Ejercicios Interactivos Destacados */}
              <section aria-labelledby="interactive-exercises-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2
                    id="interactive-exercises-heading"
                    className="text-sm font-bold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]"
                  >
                    Ejercicios interactivos guiados
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Card destacada 1: Respiración 4-7-8 */}
                  <article className="flex flex-col justify-between gap-4 rounded-xl border border-[#8FC9B5] bg-[#E0F0E8] p-5 shadow-xs sm:flex-row sm:items-center dark:border-[#4A7C59] dark:bg-[#182B1E]">
                    <div className="flex items-start gap-4">
                      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-[#1F4D2C] shadow-2xs dark:bg-[#0F1A12] dark:text-[#8FC9B5]">
                        <Wind className="size-6" strokeWidth={1.75} />
                      </div>
                      <div className="space-y-1">
                        <span className="inline-flex rounded-full bg-[#8FC9B5] px-2.5 py-0.5 text-[11px] font-semibold text-[#1A1A1A]">
                          Ejercicio guiado
                        </span>
                        <h3 className="text-lg font-bold text-[#1F4D2C] dark:text-[#F5F1E8]">
                          Respiración 4-7-8
                        </h3>
                        <p className="text-xs leading-relaxed text-[#1A1A1A]/80 dark:text-[#E5DFD3]">
                          Inhala 4s, retén 7s y exhala 8s en pantalla completa para calmar la
                          activación física.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => setIsBreathingOpen(true)}
                      className="h-10 shrink-0 cursor-pointer gap-1.5 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
                    >
                      <span>Iniciar</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </article>

                  {/* Card destacada 2: Grounding 5-4-3-2-1 */}
                  <article className="flex flex-col justify-between gap-4 rounded-xl border border-[#7B6FD8]/40 bg-[#ECE8FA] p-5 shadow-xs sm:flex-row sm:items-center dark:border-[#7B6FD8]/50 dark:bg-[#231F3A]">
                    <div className="flex items-start gap-4">
                      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-[#7B6FD8] shadow-2xs dark:bg-[#0F1A12] dark:text-[#B9B0F3]">
                        <Hand className="size-6" strokeWidth={1.75} />
                      </div>
                      <div className="space-y-1">
                        <span className="inline-flex rounded-full bg-[#7B6FD8] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          Anclaje interactivo
                        </span>
                        <h3 className="text-lg font-bold text-[#1F4D2C] dark:text-[#F5F1E8]">
                          Grounding 5-4-3-2-1
                        </h3>
                        <p className="text-xs leading-relaxed text-[#1A1A1A]/80 dark:text-[#E5DFD3]">
                          Registra 5 cosas que ves, 4 que tocas, 3 que escuchas, 2 que hueles y 1
                          que saboreas.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => setIsGroundingOpen(true)}
                      className="h-10 shrink-0 cursor-pointer gap-1.5 rounded-lg bg-[#7B6FD8] px-4 text-xs font-semibold text-white hover:bg-[#695CC8]"
                    >
                      <span>Practicar</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </article>
                </div>
              </section>

              {/* Filtros arriba: Buscador + Pills por categoría */}
              <section
                aria-label="Filtros de recursos"
                className="space-y-4 rounded-xl border border-[#E5DFD3] bg-white p-4 shadow-xs sm:p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-md">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6B6B6B]" />
                    <Input
                      type="search"
                      aria-label="Buscar recursos de bienestar"
                      placeholder="Buscar por título, tema o técnica..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 border-[#E5DFD3] bg-[#F5F1E8]/50 pl-10 text-sm text-[#1A1A1A] focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                    />
                  </div>

                  <p className="text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Mostrando{" "}
                    <span className="font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                      {filteredResources.length}
                    </span>{" "}
                    {filteredResources.length === 1 ? "recurso" : "recursos"}
                  </p>
                </div>

                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Filtrar por categoría"
                >
                  {FILTER_CATEGORIES.map((category) => {
                    const isSelected = selectedCategory === category;
                    if (category === "Todos") {
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSelectedCategory("Todos")}
                          className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                            isSelected
                              ? "border-[#1F4D2C] bg-[#1F4D2C] text-white shadow-2xs"
                              : "border-[#E5DFD3] bg-[#F5F1E8]/60 text-[#1A1A1A] hover:border-[#1F4D2C]/50 dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                          }`}
                        >
                          Todos
                        </button>
                      );
                    }

                    const visuals = getCategoryVisuals(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          isSelected
                            ? `${visuals.pillClass} shadow-2xs`
                            : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full"
                          style={{ backgroundColor: isSelected ? "currentColor" : visuals.hex }}
                        />
                        <span>{category}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Grid de tarjetas de recursos: 3 columnas desktop, 1 móvil */}
              <section aria-labelledby="resources-grid-title">
                <h2 id="resources-grid-title" className="sr-only">
                  Catálogo de recursos psicoeducativos
                </h2>

                {filteredResources.length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredResources.map((resource) => {
                      const visuals = getCategoryVisuals(resource.category);
                      return (
                        <article
                          key={resource.id}
                          className="group flex flex-col overflow-hidden rounded-xl border border-[#E5DFD3] bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#1F4D2C]/45 hover:shadow-md dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenResource(resource)}
                            className="flex flex-1 cursor-pointer flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
                          >
                            <ResourceThumbnail resource={resource} />

                            <div className="flex flex-1 flex-col justify-between p-5">
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${visuals.pillClass}`}
                                  >
                                    {visuals.label}
                                  </span>

                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6B6B6B] dark:text-[#A6B5A3]">
                                    <Clock className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                                    {resource.readTime}
                                  </span>
                                </div>

                                <h3 className="text-base font-bold leading-snug text-[#1A1A1A] transition-colors group-hover:text-[#1F4D2C] dark:text-[#F5F1E8] dark:group-hover:text-[#8FC9B5]">
                                  {resource.title}
                                </h3>

                                <p className="line-clamp-2 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A6B5A3]">
                                  {resource.shortDescription}
                                </p>
                              </div>

                              <div className="mt-4 flex items-center justify-between border-t border-[#E5DFD3] pt-3 text-xs font-semibold text-[#1F4D2C] dark:border-[#2D3F2A] dark:text-[#8FC9B5]">
                                <span>
                                  {resource.videoUrl ? "Reproducir recurso" : "Leer recurso"}
                                </span>
                                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                              </div>
                            </div>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-[#E5DFD3] bg-white p-10 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                    <BookOpen className="mb-3 size-10 text-[#6B6B6B]/60" />
                    <h3 className="text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      No encontramos recursos con ese criterio
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                      Prueba limpiando los filtros o selecciona "Todos" para ver todo el catálogo
                      activo.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategory("Todos");
                      }}
                      className="mt-4 h-9 cursor-pointer rounded-lg border-[#E5DFD3] text-xs font-semibold"
                    >
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modales interactivos de ejercicios */}
      <Respiracion478Modal isOpen={isBreathingOpen} onClose={() => setIsBreathingOpen(false)} />
      <Grounding54321Modal isOpen={isGroundingOpen} onClose={() => setIsGroundingOpen(false)} />
    </div>
  );
}
