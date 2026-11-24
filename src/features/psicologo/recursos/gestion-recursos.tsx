import { useState, useEffect, useMemo, useRef } from "react";
import {
  Library,
  Plus,
  Video,
  Play,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Search,
  BookOpen,
  Filter,
  RefreshCw,
  AlertTriangle,
  UploadCloud,
  Link as LinkIcon,
  FileVideo,
  Loader2,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CANONICAL_RESOURCE_CATEGORIES,
  detectVideoOrientation,
  deleteResource,
  fetchResourcesAsync,
  getCategoryVisuals,
  getStoredResources,
  isExternalEmbedVideo,
  normalizeResourceCategory,
  resetResourcesToDefault,
  saveResourceWithStatus,
  toggleResourceActive,
} from "@/features/recursos/recursos-service";
import { uploadDirectVideoFile, formatVideoSize } from "@/features/recursos/video-storage";
import { VideoPlayerView, type ResolvedOrientation } from "@/features/recursos/video-player-view";
import type {
  CanonicalResourceCategory,
  PsychoResource,
  ResourceFormat,
  VideoOrientation,
} from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export function GestionRecursos() {
  const { user } = useAuth();
  const [resources, setResources] = useState<PsychoResource[]>(() => getStoredResources());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<PsychoResource | null>(null);
  const [previewResource, setPreviewResource] = useState<PsychoResource | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Estado del formulario CRUD
  const [formTitle, setFormTitle] = useState("");
  const [formShortDesc, setFormShortDesc] = useState("");
  const [formCategory, setFormCategory] = useState<CanonicalResourceCategory>("Ansiedad");
  const [formFormat, setFormFormat] = useState<ResourceFormat>("video");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formVideoTitle, setFormVideoTitle] = useState("");
  const [formVideoOrientation, setFormVideoOrientation] = useState<VideoOrientation>("auto");
  const [formReadTime, setFormReadTime] = useState("5 min de práctica");
  const [formContent, setFormContent] = useState("");
  const [formKeyTakeaway, setFormKeyTakeaway] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formIconName, setFormIconName] = useState<PsychoResource["iconName"]>("bookOpen");
  const [formTone, setFormTone] = useState<PsychoResource["tone"]>("teal");
  const [formActive, setFormActive] = useState(true);

  const [previewOrientation, setPreviewOrientation] = useState<ResolvedOrientation>("horizontal");

  // Carga directa de video (máx. 150MB)
  const [videoSourceMode, setVideoSourceMode] = useState<"upload" | "url">("upload");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileName: string;
    fileSize: string;
    isLocal: boolean;
    storageError?: string;
  } | null>(null);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const data = await fetchResourcesAsync();
      setResources(data);
    }
    load();
  }, []);

  const openCreateDialog = () => {
    setEditingResource(null);
    setFormTitle("");
    setFormShortDesc("");
    setFormCategory("Ansiedad");
    setFormFormat("video");
    setFormVideoUrl("");
    setFormVideoTitle("");
    setFormVideoOrientation("auto");
    setFormReadTime("5 min de práctica");
    setFormContent(
      "Describe los pasos o fundamentos de esta técnica psicoeducativa.\n\nIndica cómo aplicarla de forma segura y gradual.",
    );
    setFormKeyTakeaway("Toma una pausa breve y aplica esta técnica a tu propio ritmo.");
    setFormAuthor(user?.name ? `${user.name} — Psicología TESH` : "Área de Psicología TESH");
    setFormIconName("bookOpen");
    setFormTone("teal");
    setFormActive(true);

    setVideoSourceMode("upload");
    setUploadedFileInfo(null);
    setUploadProgress(0);
    setIsUploadingVideo(false);

    setIsFormOpen(true);
  };

  const openEditDialog = (res: PsychoResource) => {
    setEditingResource(res);
    setFormTitle(res.title);
    setFormShortDesc(res.shortDescription);
    setFormCategory(normalizeResourceCategory(res.category));
    setFormFormat(res.format || (res.videoUrl ? "video" : "lectura"));
    setFormVideoUrl(res.videoUrl || "");
    setFormVideoTitle(res.videoTitle || "");
    setFormVideoOrientation(res.videoOrientation || "auto");
    setFormReadTime(res.readTime);
    setFormContent(res.content.join("\n\n"));
    setFormKeyTakeaway(res.keyTakeaway || "");
    setFormAuthor(res.author || "Área de Psicología TESH");
    setFormIconName(res.iconName);
    setFormTone(res.tone);
    setFormActive(res.active !== false);

    if (res.videoUrl) {
      if (isExternalEmbedVideo(res.videoUrl)) {
        setVideoSourceMode("url");
        setUploadedFileInfo(null);
      } else {
        setVideoSourceMode("upload");
        const isLocal = res.videoUrl.startsWith("indexeddb://");
        setUploadedFileInfo({
          fileName: res.videoTitle || "Archivo de video cargado",
          fileSize: isLocal ? "Guardado localmente (IndexedDB)" : "En almacenamiento en la nube",
          isLocal,
        });
      }
    } else {
      setVideoSourceMode("upload");
      setUploadedFileInfo(null);
    }

    setUploadProgress(0);
    setIsUploadingVideo(false);
    setIsFormOpen(true);
  };

  const handleProcessVideoFile = async (file: File) => {
    setIsUploadingVideo(true);
    setUploadProgress(15);

    try {
      const result = await uploadDirectVideoFile(file, (pct) => setUploadProgress(pct));
      setFormVideoUrl(result.url);
      setFormFormat("video");
      setFormVideoOrientation(result.orientation);
      if (!formVideoTitle.trim()) {
        setFormVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      setUploadedFileInfo({
        fileName: result.fileName,
        fileSize: formatVideoSize(result.size),
        isLocal: result.isLocal,
        storageError: result.storageError,
      });

      if (result.isLocal) {
        toast.warning("Video guardado localmente en este navegador (IndexedDB).", {
          description: result.storageError
            ? `Motivo: ${result.storageError}`
            : "Configura el bucket 'recursos-videos' en Supabase para sincronizar entre dispositivos.",
        });
      } else {
        toast.success("Video subido a Supabase Storage con éxito.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al procesar el archivo de video");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessVideoFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDropVideo = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVideo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessVideoFile(file);
    }
  };

  const handleRemoveVideo = () => {
    setFormVideoUrl("");
    setFormVideoTitle("");
    setFormVideoOrientation("auto");
    setUploadedFileInfo(null);
    setUploadProgress(0);
    toast.info("Video removido del recurso.");
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("El título del recurso es obligatorio.");
      return;
    }

    const paragraphs = formContent
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const payload: Partial<PsychoResource> & { title: string } = {
      id: editingResource ? editingResource.id : undefined,
      title: formTitle.trim(),
      shortDescription: formShortDesc.trim(),
      category: formCategory,
      format: formVideoUrl.trim() ? "video" : formFormat,
      videoUrl: formVideoUrl.trim() || undefined,
      videoTitle: formVideoTitle.trim() || undefined,
      videoOrientation: formVideoOrientation,
      readTime: formReadTime.trim() || "4 min",
      content:
        paragraphs.length > 0 ? paragraphs : ["Contenido de apoyo elaborado por Psicología TESH."],
      keyTakeaway: formKeyTakeaway.trim() || undefined,
      author: formAuthor.trim() || "Área de Psicología TESH",
      iconName: formIconName,
      tone: formTone,
      active: formActive,
    };

    const { resource: saved, syncedToDb, dbError } = await saveResourceWithStatus(payload);
    setResources((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });

    setIsFormOpen(false);
    if (syncedToDb) {
      toast.success(
        editingResource
          ? "Recurso actualizado y sincronizado en la base de datos"
          : "Nuevo recurso publicado y guardado en la base de datos",
      );
    } else {
      toast.warning(
        editingResource
          ? "Recurso actualizado localmente (sin sincronizar a Supabase)"
          : "Recurso guardado localmente en este navegador",
        {
          description: dbError
            ? `Detalle BD: ${dbError}`
            : "Ejecuta supabase/schema_recursos.sql para habilitar la tabla 'recursos'.",
        },
      );
    }
  };

  const handleDelete = async (id: string) => {
    await deleteResource(id);
    setResources((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirmId(null);
    toast.success("Recurso eliminado del catálogo");
  };

  const handleToggle = async (id: string) => {
    const newState = await toggleResourceActive(id);
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, active: newState } : r)));
    toast.info(newState ? "Recurso visible para estudiantes" : "Recurso ocultado para estudiantes");
  };

  const handleResetDefaults = () => {
    const def = resetResourcesToDefault();
    setResources(def);
    toast.success("Catálogo restaurado a los recursos oficiales TESH");
  };

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const canonical = normalizeResourceCategory(res.category);
      const matchesCategory = selectedCategory === "all" || canonical === selectedCategory;
      const matchesFormat =
        selectedFormat === "all" ||
        (selectedFormat === "video" && !!res.videoUrl) ||
        (selectedFormat === "lectura" && !res.videoUrl);

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        res.title.toLowerCase().includes(q) ||
        res.shortDescription.toLowerCase().includes(q) ||
        canonical.toLowerCase().includes(q) ||
        (res.author && res.author.toLowerCase().includes(q));

      return matchesCategory && matchesFormat && matchesQuery;
    });
  }, [resources, selectedCategory, selectedFormat, searchQuery]);

  const stats = useMemo(() => {
    const total = resources.length;
    const conVideo = resources.filter((r) => !!r.videoUrl).length;
    const activos = resources.filter((r) => r.active !== false).length;
    return { total, conVideo, activos };
  }, [resources]);

  return (
    <div className="space-y-6">
      {/* Encabezado clínico institucional */}
      <div className="flex flex-col gap-4 rounded-xl border border-[#E5DFD3] bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F4D2C] dark:text-[#8FC9B5]">
            <Library className="size-4" />
            <span>Módulo Psicoeducativo TESH</span>
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
            Gestión de Recursos de Bienestar
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-[#6B6B6B] sm:text-sm dark:text-[#A6B5A3]">
            Administra lecturas y videos demostrativos (MP4/WebM hasta 150 MB o YouTube/Vimeo)
            visibles para estudiantes en{" "}
            <span className="font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">/recursos</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDefaults}
            className="h-9 cursor-pointer gap-1.5 rounded-lg border-[#E5DFD3] text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#F5F1E8]"
          >
            <RefreshCw className="size-3.5" />
            <span>Restaurar catálogo</span>
          </Button>

          <Button
            type="button"
            onClick={openCreateDialog}
            className="h-9 cursor-pointer gap-1.5 rounded-lg bg-[#1F4D2C] px-4 text-xs font-semibold text-white hover:bg-[#4A7C59]"
          >
            <Plus className="size-4" />
            <span>Crear recurso</span>
          </Button>
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 shadow-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between text-[#6B6B6B] dark:text-[#A6B5A3]">
            <span className="text-xs font-semibold">Total en catálogo</span>
            <BookOpen className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-[#1F4D2C] dark:text-[#F5F1E8]">
            {stats.total}
          </p>
          <span className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
            Materiales registrados
          </span>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 shadow-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between text-[#6B6B6B] dark:text-[#A6B5A3]">
            <span className="text-xs font-semibold">Con video demostrativo</span>
            <Video className="size-4 text-[#7B6FD8]" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-[#1A1A1A] dark:text-[#F5F1E8]">
            {stats.conVideo}
          </p>
          <span className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
            MP4/WebM o YouTube/Vimeo
          </span>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4 shadow-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="flex items-center justify-between text-[#6B6B6B] dark:text-[#A6B5A3]">
            <span className="text-xs font-semibold">Visibles para estudiantes</span>
            <CheckCircle2 className="size-4 text-[#1F4D2C] dark:text-[#8FC9B5]" />
          </div>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-[#1F4D2C] dark:text-[#8FC9B5]">
            {stats.activos}
          </p>
          <span className="text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
            {stats.total - stats.activos} oculto(s)
          </span>
        </div>
      </div>

      {/* Filtros de tabla */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A] dark:bg-[#1A2618]">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#6B6B6B]" />
          <Input
            type="search"
            placeholder="Buscar por título, categoría o autor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-[#E5DFD3] bg-[#F5F1E8]/50 pl-8 text-xs focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
            <Filter className="size-3.5" />
            <span>Filtros:</span>
          </div>
          <select
            aria-label="Filtrar por categoría"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
          >
            <option value="all">Todas las categorías ({resources.length})</option>
            {CANONICAL_RESOURCE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por formato"
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="h-9 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
          >
            <option value="all">Todos los formatos</option>
            <option value="video">Solo con video</option>
            <option value="lectura">Solo lecturas</option>
          </select>
        </div>
      </div>

      {/* Tabla CRUD institucional de recursos */}
      {filteredResources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5DFD3] bg-white p-10 text-center dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <Library className="mx-auto size-9 text-[#6B6B6B]/60" />
          <h3 className="mt-2 text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
            No se encontraron recursos con los filtros actuales
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
            Ajusta el buscador o crea un nuevo recurso para la biblioteca estudiantil.
          </p>
          <Button
            type="button"
            onClick={openCreateDialog}
            className="mt-4 h-9 cursor-pointer rounded-lg bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
          >
            Crear recurso
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E5DFD3] bg-white shadow-xs dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5DFD3] bg-[#F5F1E8] text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
                  <th className="px-4 py-3.5">Recurso</th>
                  <th className="px-4 py-3.5">Categoría</th>
                  <th className="px-4 py-3.5">Formato / Duración</th>
                  <th className="px-4 py-3.5">Visibilidad</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
                {filteredResources.map((res) => {
                  const hasVideo = Boolean(res.videoUrl);
                  const isVisible = res.active !== false;
                  const visuals = getCategoryVisuals(res.category);

                  return (
                    <tr
                      key={res.id}
                      className={`transition-colors hover:bg-[#F5F1E8]/55 dark:hover:bg-[#0F1A12]/50 ${
                        !isVisible ? "opacity-65" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="max-w-md space-y-0.5">
                          <p className="font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                            {res.title}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                            {res.shortDescription || "Sin descripción breve"}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${visuals.pillClass}`}
                        >
                          {visuals.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit items-center gap-1 rounded-md border border-[#E5DFD3] bg-[#F5F1E8]/60 px-2 py-0.5 text-[11px] font-semibold text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
                            {hasVideo ? (
                              <>
                                <Play className="size-3 fill-current text-[#1F4D2C] dark:text-[#8FC9B5]" />
                                <span>
                                  {detectVideoOrientation(res.videoUrl, res.videoOrientation) ===
                                  "vertical"
                                    ? "Video vertical"
                                    : "Video"}
                                </span>
                              </>
                            ) : (
                              <>
                                <BookOpen className="size-3 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                                <span>Lectura</span>
                              </>
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                            <Clock className="size-3" />
                            {res.readTime}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                            isVisible
                              ? "border-[#1F4D2C]/25 bg-[#E0F0E8] text-[#1F4D2C]"
                              : "border-[#E5DFD3] bg-[#F5F1E8] text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]"
                          }`}
                        >
                          {isVisible ? (
                            <>
                              <Eye className="size-3" />
                              <span>Visible</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="size-3" />
                              <span>Oculto</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPreviewOrientation(
                                detectVideoOrientation(res.videoUrl, res.videoOrientation),
                              );
                              setPreviewResource(res);
                            }}
                            title="Vista previa estudiante"
                            className="h-8 cursor-pointer gap-1 rounded-lg px-2 text-xs text-[#6B6B6B] hover:bg-[#F5F1E8] hover:text-[#1F4D2C]"
                          >
                            <Play className="size-3.5" />
                            <span className="hidden xl:inline">Ver</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(res)}
                            className="h-8 cursor-pointer gap-1 rounded-lg border-[#E5DFD3] px-2.5 text-xs font-semibold text-[#1A1A1A] hover:border-[#1F4D2C] hover:text-[#1F4D2C] dark:border-[#2D3F2A] dark:text-[#F5F1E8]"
                          >
                            <Pencil className="size-3.5" />
                            <span>Editar</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggle(res.id)}
                            title={isVisible ? "Ocultar a estudiantes" : "Mostrar a estudiantes"}
                            className="h-8 cursor-pointer gap-1 rounded-lg border-[#E5DFD3] px-2.5 text-xs font-semibold text-[#1F4D2C] hover:bg-[#E0F0E8] dark:border-[#2D3F2A] dark:text-[#8FC9B5]"
                          >
                            {isVisible ? (
                              <>
                                <EyeOff className="size-3.5" />
                                <span>Ocultar</span>
                              </>
                            ) : (
                              <>
                                <Eye className="size-3.5" />
                                <span>Mostrar</span>
                              </>
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(res.id)}
                            title="Eliminar recurso"
                            aria-label={`Eliminar ${res.title}`}
                            className="h-8 cursor-pointer rounded-lg px-2 text-xs text-[#C8102E] hover:bg-[#FEE2E2]"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DIÁLOGO: CREAR / EDITAR RECURSO */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[#E5DFD3] bg-white text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
          <form onSubmit={handleSaveForm} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                {editingResource ? (
                  <>
                    <Pencil className="size-4" />
                    <span>Editar recurso psicoeducativo</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    <span>Crear nuevo recurso</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                Configura título, descripción, categoría, video (drag & drop hasta 150 MB o URL) y
                visibilidad en el catálogo de estudiantes.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Título del recurso *
                </label>
                <Input
                  required
                  placeholder="Ej. Respiración diafragmática consciente"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="text-xs border-[#E5DFD3] focus-visible:ring-[#1F4D2C]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Descripción corta
                </label>
                <Input
                  placeholder="Resumen breve visible en la tarjeta del estudiante"
                  value={formShortDesc}
                  onChange={(e) => setFormShortDesc(e.target.value)}
                  className="text-xs border-[#E5DFD3] focus-visible:ring-[#1F4D2C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Categoría
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as CanonicalResourceCategory)}
                  className="h-9 w-full rounded-md border border-[#E5DFD3] bg-white px-3 text-xs text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  {CANONICAL_RESOURCE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Duración estimada
                </label>
                <Input
                  placeholder="Ej. 4 min de lectura o 5 min de práctica"
                  value={formReadTime}
                  onChange={(e) => setFormReadTime(e.target.value)}
                  className="text-xs border-[#E5DFD3] focus-visible:ring-[#1F4D2C]"
                />
              </div>

              {/* Visibilidad */}
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 px-3.5 py-2.5 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  <div>
                    <span className="block text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      Visibilidad en /recursos
                    </span>
                    <span className="block text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                      {formActive
                        ? "Visible inmediatamente para todos los estudiantes."
                        : "Oculto (borrador): solo visible en el panel de psicología."}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="size-4 cursor-pointer accent-[#1F4D2C]"
                  />
                </label>
              </div>

              {/* Video Demostrativo: Upload Drag & Drop (150MB) o URL */}
              <div className="space-y-3 rounded-xl border border-[#8FC9B5] bg-[#E0F0E8]/45 p-4 sm:col-span-2 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    <Video className="size-4" />
                    <span>Archivo de video o URL (Opcional)</span>
                  </div>

                  {formVideoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveVideo}
                      className="h-6 cursor-pointer px-2 text-[11px] text-[#C8102E] hover:bg-[#FEE2E2]"
                    >
                      Quitar video
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#E5DFD3] bg-white p-1 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                  <button
                    type="button"
                    onClick={() => setVideoSourceMode("upload")}
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      videoSourceMode === "upload"
                        ? "bg-[#1F4D2C] text-white"
                        : "text-[#6B6B6B] hover:text-[#1A1A1A] dark:text-[#A6B5A3]"
                    }`}
                  >
                    <UploadCloud className="size-3.5" />
                    <span>Subir MP4 / WebM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVideoSourceMode("url")}
                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      videoSourceMode === "url"
                        ? "bg-[#1F4D2C] text-white"
                        : "text-[#6B6B6B] hover:text-[#1A1A1A] dark:text-[#A6B5A3]"
                    }`}
                  >
                    <LinkIcon className="size-3.5" />
                    <span>URL YouTube / Vimeo</span>
                  </button>
                </div>

                {videoSourceMode === "upload" && (
                  <div className="space-y-3 pt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/ogg,video/quicktime"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />

                    {isUploadingVideo ? (
                      <div className="space-y-2 rounded-xl border border-dashed border-[#1F4D2C]/50 bg-white p-6 text-center dark:bg-[#1A2618]">
                        <Loader2 className="mx-auto size-7 animate-spin text-[#1F4D2C]" />
                        <p className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Procesando video... {uploadProgress}%
                        </p>
                        <div className="mx-auto h-2 w-full max-w-xs overflow-hidden rounded-full bg-[#E5DFD3]">
                          <div
                            className="h-full bg-[#1F4D2C] transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : formVideoUrl && !isExternalEmbedVideo(formVideoUrl) ? (
                      <div className="space-y-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="grid size-8 place-items-center rounded-lg bg-[#E0F0E8] text-[#1F4D2C]">
                              <FileVideo className="size-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                                {uploadedFileInfo?.fileName || formVideoTitle || "Video cargado"}
                              </p>
                              <p className="flex flex-wrap items-center gap-2 text-[11px] text-[#6B6B6B]">
                                <span>{uploadedFileInfo?.fileSize || "Listo"}</span>
                                <span>•</span>
                                {uploadedFileInfo?.isLocal ? (
                                  <span className="flex items-center gap-1 font-medium text-[#B8860B]">
                                    <AlertTriangle className="size-3" /> Local (este navegador)
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5 font-medium text-[#1F4D2C]">
                                    <Check className="size-3" /> En Supabase Storage
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-7 cursor-pointer text-xs"
                          >
                            Cambiar archivo
                          </Button>
                        </div>

                        <div className="flex justify-center">
                          <VideoPlayerView
                            videoUrl={formVideoUrl}
                            title={formVideoTitle || formTitle}
                            orientation={formVideoOrientation}
                            className={
                              formVideoOrientation === "vertical" ? "max-w-[230px]" : "max-h-60"
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingVideo(true);
                        }}
                        onDragLeave={() => setIsDraggingVideo(false)}
                        onDrop={handleDropVideo}
                        onClick={() => fileInputRef.current?.click()}
                        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                          isDraggingVideo
                            ? "border-[#1F4D2C] bg-[#E0F0E8]"
                            : "border-[#E5DFD3] bg-white hover:border-[#1F4D2C]/60 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                        }`}
                      >
                        <UploadCloud className="mx-auto mb-2 size-8 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                        <p className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                          Arrastra un video aquí o haz clic para seleccionar
                        </p>
                        <p className="mt-1 text-[11px] text-[#6B6B6B] dark:text-[#A6B5A3]">
                          Formatos MP4, WebM o MOV (máximo 150 MB). Detección automática de
                          orientación.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {videoSourceMode === "url" && (
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      URL de YouTube, Shorts o Vimeo
                    </label>
                    <Input
                      placeholder="https://www.youtube.com/watch?v=... o https://vimeo.com/..."
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      className="border-[#E5DFD3] bg-white text-xs dark:bg-[#1A2618]"
                    />

                    {formVideoUrl && isExternalEmbedVideo(formVideoUrl) && (
                      <div className="flex flex-col items-center pt-2">
                        <VideoPlayerView
                          videoUrl={formVideoUrl}
                          title={formVideoTitle || formTitle}
                          orientation={formVideoOrientation}
                          className={
                            detectVideoOrientation(formVideoUrl, formVideoOrientation) ===
                            "vertical"
                              ? "max-w-[230px]"
                              : "max-h-60"
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {formVideoUrl && (
                  <div className="space-y-1.5 border-t border-[#E5DFD3] pt-2">
                    <label className="block text-[11px] font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      Orientación del reproductor
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {(
                        [
                          { id: "auto", label: "Automático" },
                          { id: "horizontal", label: "Horizontal (16:9)" },
                          { id: "vertical", label: "Vertical (9:16)" },
                          { id: "square", label: "Cuadrado (1:1)" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFormVideoOrientation(opt.id)}
                          className={`cursor-pointer rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                            formVideoOrientation === opt.id
                              ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
                              : "border-[#E5DFD3] bg-white text-[#6B6B6B] hover:text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1 border-t border-[#E5DFD3] pt-2">
                  <label className="text-[11px] font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Título del video (opcional)
                  </label>
                  <Input
                    placeholder="Ej. Guía demostrativa de respiración consciente"
                    value={formVideoTitle}
                    onChange={(e) => setFormVideoTitle(e.target.value)}
                    className="border-[#E5DFD3] bg-white text-xs dark:bg-[#1A2618]"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Contenido completo (separa párrafos con doble salto de línea)
                </label>
                <Textarea
                  rows={4}
                  placeholder="Párrafo 1...\n\nPárrafo 2..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="resize-y border-[#E5DFD3] text-xs focus-visible:ring-[#1F4D2C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Idea para recordar
                </label>
                <Input
                  placeholder="Ej. Inhala en 4, sostén en 7, exhala en 8."
                  value={formKeyTakeaway}
                  onChange={(e) => setFormKeyTakeaway(e.target.value)}
                  className="text-xs border-[#E5DFD3] focus-visible:ring-[#1F4D2C]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Responsable clínico
                </label>
                <Input
                  placeholder="Área de Psicología TESH"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                  className="text-xs border-[#E5DFD3] focus-visible:ring-[#1F4D2C]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                className="cursor-pointer border-[#E5DFD3] text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isUploadingVideo}
                className="cursor-pointer bg-[#1F4D2C] text-xs font-semibold text-white hover:bg-[#4A7C59]"
              >
                {editingResource ? "Guardar cambios" : "Publicar recurso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: VISTA PREVIA ESTUDIANTE */}
      <Dialog open={!!previewResource} onOpenChange={() => setPreviewResource(null)}>
        <DialogContent
          className={`${
            previewResource?.videoUrl && previewOrientation === "vertical"
              ? "max-w-3xl"
              : "max-w-2xl"
          } max-h-[88vh] overflow-y-auto border-[#E5DFD3] bg-white text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]`}
        >
          {previewResource && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      getCategoryVisuals(previewResource.category).pillClass
                    }`}
                  >
                    {getCategoryVisuals(previewResource.category).label}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-[#1F4D2C] dark:text-[#8FC9B5]">
                    <Clock className="size-3" />
                    {previewResource.readTime}
                  </span>
                </div>
                <span className="rounded-md border border-[#8FC9B5] bg-[#E0F0E8] px-2 py-0.5 text-[10px] font-semibold text-[#1F4D2C]">
                  Vista previa estudiante
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-[#1F4D2C] dark:text-[#F5F1E8]">
                    {previewResource.title}
                  </h2>
                  <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                    {previewResource.shortDescription}
                  </p>
                </div>

                {previewResource.videoUrl && (
                  <VideoPlayerView
                    videoUrl={previewResource.videoUrl}
                    title={previewResource.videoTitle || previewResource.title}
                    orientation={previewResource.videoOrientation}
                    onOrientationDetected={setPreviewOrientation}
                  />
                )}

                <div className="space-y-2.5 rounded-xl border border-[#E5DFD3] bg-[#F5F1E8]/50 p-4 text-xs leading-relaxed dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                  {previewResource.content.map((par, i) => (
                    <p key={i}>{par}</p>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewResource(null)}
                  className="cursor-pointer border-[#E5DFD3] text-xs"
                >
                  Cerrar vista previa
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: CONFIRMAR ELIMINACIÓN */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-md border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#C8102E]">
              <AlertTriangle className="size-4" />
              <span>Confirmar eliminación</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              ¿Deseas eliminar este recurso del catálogo? Los estudiantes dejarán de verlo en
              /recursos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(null)}
              className="cursor-pointer border-[#E5DFD3] text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="cursor-pointer bg-[#C8102E] text-xs font-semibold text-white hover:bg-[#9B0C24]"
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
