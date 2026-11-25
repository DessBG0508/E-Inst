import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Link2,
  MapPin,
  Megaphone,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AnuncioDetailModal } from "@/features/anuncios/anuncio-detail-modal";
import { AnuncioFlyerPreview } from "@/features/anuncios/anuncio-flyer-preview";
import {
  createAnuncio,
  deleteAnuncio,
  fetchAnuncios,
  toggleAnuncioActivo,
  updateAnuncio,
} from "@/features/anuncios/anuncios-service";
import { uploadAnuncioFlyer } from "@/features/anuncios/flyer-storage";
import {
  ANUNCIO_TIPO_META,
  PUBLICO_OBJETIVO_LABELS,
  cleanAnuncioTitle,
  formatFechaMx,
  type AnuncioFormInput,
  type AnuncioItem,
  type AnuncioPublicoObjetivo,
  type AnuncioTipo,
} from "@/features/anuncios/types";
import { useAuth } from "@/lib/auth-context";

const EMPTY_FORM: AnuncioFormInput = {
  titulo: "",
  descripcion: "",
  descripcion_larga: "",
  tipo: "taller",
  fecha_evento: "",
  hora_inicio: "11:00",
  hora_fin: "12:30",
  lugar: "",
  ponente: "",
  requisitos: "",
  cupo: 30,
  publico_objetivo: "todos",
  imagen_url: "",
  activo: true,
};

type VisibilityFilter = "todos" | "activos" | "ocultos";

export function GestionAnuncios() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("todos");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AnuncioItem | null>(null);
  const [form, setForm] = useState<AnuncioFormInput>(EMPTY_FORM);
  const [flyerInputMode, setFlyerInputMode] = useState<"upload" | "url">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingFlyer, setIsUploadingFlyer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [previewItem, setPreviewItem] = useState<AnuncioItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnuncioItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAnuncios = async () => {
    setIsLoading(true);
    try {
      const list = await fetchAnuncios({ includeInactive: true });
      setAnuncios(list);
    } catch {
      toast.error("No se pudo cargar la lista de anuncios y talleres.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnuncios();
  }, []);

  const filteredAnuncios = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return anuncios.filter((item) => {
      if (visibilityFilter === "activos" && !item.activo) return false;
      if (visibilityFilter === "ocultos" && item.activo) return false;
      if (q) {
        const title = cleanAnuncioTitle(item.titulo).toLowerCase();
        const desc = item.descripcion.toLowerCase();
        if (!title.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [anuncios, searchQuery, visibilityFilter]);

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFlyerInputMode("upload");
    setIsFormOpen(true);
  };

  const openEditModal = (item: AnuncioItem) => {
    setEditingItem(item);
    setForm({
      titulo: item.titulo,
      descripcion: item.descripcion,
      descripcion_larga: item.descripcion_larga || "",
      tipo: item.tipo,
      fecha_evento: item.fecha_evento || "",
      hora_inicio: item.hora_inicio || "",
      hora_fin: item.hora_fin || "",
      lugar: item.lugar || "",
      ponente: item.ponente || "",
      requisitos: item.requisitos || "",
      cupo: item.cupo ?? null,
      publico_objetivo: item.publico_objetivo,
      imagen_url: item.imagen_url || "",
      activo: item.activo,
    });
    setFlyerInputMode(item.imagen_url && !item.imagen_url.startsWith("data:") ? "url" : "upload");
    setIsFormOpen(true);
  };

  const handleFlyerFile = async (file: File) => {
    setIsUploadingFlyer(true);
    try {
      const result = await uploadAnuncioFlyer(file);
      setForm((prev) => ({ ...prev, imagen_url: result.url }));
      if (result.isLocalFallback && result.storageWarning) {
        toast.info(`Flyer cargado localmente (${result.fileName}).`);
      } else {
        toast.success(`Flyer "${result.fileName}" cargado correctamente.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen del flyer.");
    } finally {
      setIsUploadingFlyer(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFlyerFile(file);
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      toast.error("Ingresa un título para el anuncio o taller.");
      return;
    }
    if (!form.descripcion.trim()) {
      toast.error("Ingresa una descripción corta.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        const updated = await updateAnuncio(editingItem.id, form);
        setAnuncios((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        toast.success("Anuncio actualizado correctamente.");
      } else {
        const created = await createAnuncio(form, user?.id);
        setAnuncios((prev) => [created, ...prev]);
        toast.success("Anuncio publicado correctamente.");
      }
      setIsFormOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el anuncio.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisibility = async (item: AnuncioItem) => {
    const nextActivo = !item.activo;
    try {
      await toggleAnuncioActivo(item.id, nextActivo);
      setAnuncios((prev) => prev.map((a) => (a.id === item.id ? { ...a, activo: nextActivo } : a)));
      toast.success(nextActivo ? "Anuncio visible para estudiantes." : "Anuncio ocultado.");
    } catch {
      toast.error("No se pudo cambiar la visibilidad del anuncio.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAnuncio(deleteTarget.id);
      setAnuncios((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success("Anuncio eliminado.");
      setDeleteTarget(null);
    } catch {
      toast.error("No se pudo eliminar el anuncio.");
    } finally {
      setIsDeleting(false);
    }
  };

  const previewMeta = ANUNCIO_TIPO_META[form.tipo] || ANUNCIO_TIPO_META.taller;
  const previewTitle = cleanAnuncioTitle(form.titulo || "Título del anuncio o taller");
  const previewCupoTotal = typeof form.cupo === "number" && form.cupo > 0 ? form.cupo : null;
  const previewInscritos = editingItem ? editingItem.inscritos : 0;
  const previewPercent = previewCupoTotal
    ? Math.min(100, Math.round((previewInscritos / previewCupoTotal) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado de sección */}
      <div className="flex flex-col gap-4 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A] sm:text-2xl dark:text-[#F5F1E8]">
            Anuncios y Talleres
          </h2>
          <p className="mt-1 text-xs text-[#6B6B6B] sm:text-sm dark:text-[#A8B5A0]">
            Publica convocatorias, talleres psicoeducativos y recordatorios visibles en el inicio
            estudiantil.
          </p>
        </div>

        <Button type="button" onClick={openCreateModal} className="h-11 shrink-0">
          <Plus className="size-4" />
          Nuevo anuncio
        </Button>
      </div>

      {/* Filtros y buscador */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "todos", label: `Todos (${anuncios.length})` },
              {
                id: "activos",
                label: `Visibles (${anuncios.filter((a) => a.activo).length})`,
              },
              {
                id: "ocultos",
                label: `Ocultos (${anuncios.filter((a) => !a.activo).length})`,
              },
            ] as const
          ).map((tab) => {
            const active = visibilityFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setVisibilityFilter(tab.id)}
                className={`inline-flex h-9 cursor-pointer items-center rounded-lg border px-3.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-[#1F4D2C] bg-[#1F4D2C] text-white"
                    : "border-[#E5DFD3] bg-white text-[#1A1A1A] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:hover:bg-[#223120]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#6B6B6B] dark:text-[#A8B5A0]" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar anuncio..."
            className="h-10 pl-10"
          />
        </div>
      </div>

      {/* Lista de anuncios */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-lg border border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]"
            />
          ))}
        </div>
      ) : filteredAnuncios.length === 0 ? (
        <Card className="p-10 text-center">
          <Megaphone className="mx-auto size-8 text-[#6B6B6B] dark:text-[#A8B5A0]" />
          <h3 className="mt-3 text-base font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
            No hay anuncios registrados con este filtro
          </h3>
          <p className="mt-1 text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
            Crea un nuevo taller, evento o recordatorio para la comunidad estudiantil.
          </p>
          <Button type="button" onClick={openCreateModal} className="mt-4 h-10">
            <Plus className="size-4" />
            Crear primer anuncio
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredAnuncios.map((item) => {
            const meta = ANUNCIO_TIPO_META[item.tipo] || ANUNCIO_TIPO_META.taller;
            const cleanTitle = cleanAnuncioTitle(item.titulo);
            const hasCupo = typeof item.cupo === "number" && item.cupo > 0;

            return (
              <Card
                key={item.id}
                className={`overflow-hidden p-0 transition-opacity ${
                  item.activo ? "" : "opacity-75"
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-[170px_minmax(0,1fr)]">
                  <AnuncioFlyerPreview
                    imagenUrl={item.imagen_url}
                    titulo={cleanTitle}
                    tipo={item.tipo}
                    className="h-40 w-full sm:h-full sm:min-h-[180px]"
                  />

                  <div className="flex flex-col justify-between gap-3 p-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={meta.badgeClassName}>{meta.label}</Badge>
                          <Badge variant={item.activo ? "mint" : "neutral"}>
                            {item.activo ? "Visible" : "Oculto"}
                          </Badge>
                        </div>
                        <span className="font-mono text-xs font-semibold tabular-nums text-[#6B6B6B] dark:text-[#A8B5A0]">
                          {hasCupo ? `${item.inscritos}/${item.cupo} lugares` : "Acceso abierto"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold leading-snug text-[#1A1A1A] dark:text-[#F5F1E8]">
                        {cleanTitle}
                      </h3>
                      <p className="line-clamp-2 text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A8B5A0]">
                        {item.descripcion}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B6B6B] dark:text-[#A8B5A0]">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                          {formatFechaMx(item.fecha_evento)}
                        </span>
                        {item.lugar && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                            <span className="truncate max-w-[180px]">{item.lugar}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DFD3] pt-3 dark:border-[#2D3F2A]">
                      <span className="text-[11px] font-medium text-[#6B6B6B] dark:text-[#A8B5A0]">
                        Público: {PUBLICO_OBJETIVO_LABELS[item.publico_objetivo]}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewItem(item)}
                          title="Vista previa"
                          aria-label={`Vista previa de ${cleanTitle}`}
                          className="h-8 px-2.5 text-xs"
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleVisibility(item)}
                          title={item.activo ? "Ocultar anuncio" : "Mostrar anuncio"}
                          className="h-8 px-2.5 text-xs"
                        >
                          {item.activo ? (
                            <>
                              <EyeOff className="size-3.5" />
                              Ocultar
                            </>
                          ) : (
                            <>
                              <Eye className="size-3.5" />
                              Mostrar
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(item)}
                          className="h-8 px-2.5 text-xs"
                        >
                          <Edit3 className="size-3.5" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Eliminar ${cleanTitle}`}
                          className="h-8 px-2.5 text-xs"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar con Vista Previa en Vivo */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-lg border border-[#E5DFD3] bg-white p-0 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
          <DialogHeader className="border-b border-[#E5DFD3] px-6 py-4 dark:border-[#2D3F2A]">
            <DialogTitle className="text-lg font-bold">
              {editingItem ? "Editar anuncio o taller" : "Crear nuevo anuncio o taller"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
              Completa los datos de la convocatoria y verifica la vista previa en vivo antes de
              publicar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
            {/* Columna izquierda: Formulario */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Título *
                </label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                  placeholder="Ej. Manejo del estrés antes de exámenes finales"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Tipo *
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, tipo: e.target.value as AnuncioTipo }))
                    }
                    className="h-11 w-full rounded-lg border border-[#E5DFD3] bg-white px-3 text-sm text-[#1A1A1A] focus:border-[#1F4D2C] focus:ring-2 focus:ring-[#1F4D2C] focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-white"
                  >
                    <option value="taller">Taller</option>
                    <option value="evento">Evento</option>
                    <option value="informativo">Informativo</option>
                    <option value="recordatorio">Recordatorio</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Público objetivo
                  </label>
                  <select
                    value={form.publico_objetivo}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        publico_objetivo: e.target.value as AnuncioPublicoObjetivo,
                      }))
                    }
                    className="h-11 w-full rounded-lg border border-[#E5DFD3] bg-white px-3 text-sm text-[#1A1A1A] focus:border-[#1F4D2C] focus:ring-2 focus:ring-[#1F4D2C] focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-white"
                  >
                    <option value="todos">Todos los estudiantes</option>
                    <option value="rojo">Semáforo rojo</option>
                    <option value="amarillo">Semáforo amarillo</option>
                    <option value="verde">Semáforo verde</option>
                    <option value="sin_tamizaje">Sin tamizaje reciente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Descripción corta *
                </label>
                <textarea
                  rows={2}
                  value={form.descripcion}
                  onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Resumen breve mostrado en tarjetas y en el carrusel de inicio..."
                  className="w-full rounded-lg border border-[#E5DFD3] bg-white p-3 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/60 focus:border-[#1F4D2C] focus:ring-2 focus:ring-[#1F4D2C] focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  Descripción larga (temario completo)
                </label>
                <textarea
                  rows={4}
                  value={form.descripcion_larga || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, descripcion_larga: e.target.value }))
                  }
                  placeholder="Módulos, objetivos, dinámica de la sesión..."
                  className="w-full rounded-lg border border-[#E5DFD3] bg-white p-3 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/60 focus:border-[#1F4D2C] focus:ring-2 focus:ring-[#1F4D2C] focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Fecha del evento
                  </label>
                  <Input
                    type="date"
                    value={form.fecha_evento || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha_evento: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Hora inicio
                  </label>
                  <Input
                    type="time"
                    value={form.hora_inicio || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, hora_inicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Hora fin
                  </label>
                  <Input
                    type="time"
                    value={form.hora_fin || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, hora_fin: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Lugar
                  </label>
                  <Input
                    value={form.lugar || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, lugar: e.target.value }))}
                    placeholder="Ej. Auditorio Edificio B"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Ponente
                  </label>
                  <Input
                    value={form.ponente || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, ponente: e.target.value }))}
                    placeholder="Nombre del ponente o área"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Requisitos
                  </label>
                  <Input
                    value={form.requisitos || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, requisitos: e.target.value }))}
                    placeholder="Ej. Credencial TESH vigente"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Cupo máximo
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.cupo ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        cupo: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    placeholder="Sin límite"
                  />
                </div>
              </div>

              {/* Subida de Flyer: Drag & Drop o URL */}
              <div className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-4 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Flyer promocional (JPG, PNG, WebP o GIF)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFlyerInputMode("upload")}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        flyerInputMode === "upload"
                          ? "bg-[#1F4D2C] text-white"
                          : "bg-white text-[#1A1A1A] border border-[#E5DFD3] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:border-[#2D3F2A]"
                      }`}
                    >
                      <Upload className="size-3" />
                      Subir archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlyerInputMode("url")}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        flyerInputMode === "url"
                          ? "bg-[#1F4D2C] text-white"
                          : "bg-white text-[#1A1A1A] border border-[#E5DFD3] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:border-[#2D3F2A]"
                      }`}
                    >
                      <Link2 className="size-3" />
                      Pegar URL
                    </button>
                  </div>
                </div>

                {flyerInputMode === "upload" ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
                      isDragging
                        ? "border-[#1F4D2C] bg-[#1F4D2C]/10"
                        : "border-[#E5DFD3] bg-white hover:border-[#1F4D2C]/60 dark:border-[#2D3F2A] dark:bg-[#1A2618]"
                    }`}
                  >
                    <ImagePlus className="size-6 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                    <p className="mt-2 text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {isUploadingFlyer
                        ? "Subiendo flyer..."
                        : "Arrastra y suelta tu flyer aquí o haz clic para seleccionar"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#6B6B6B] dark:text-[#A8B5A0]">
                      Formatos aceptados: JPG, PNG, WebP, GIF (máx. 10 MB)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFlyerFile(file);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </div>
                ) : (
                  <Input
                    type="url"
                    value={form.imagen_url || ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, imagen_url: e.target.value }))}
                    placeholder="https://..."
                  />
                )}

                {form.imagen_url && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="truncate text-[11px] text-[#1F4D2C] dark:text-[#8FC9B5]">
                      Flyer listo para mostrarse en la vista previa
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, imagen_url: "" }))}
                      className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-[#C8102E] hover:underline"
                    >
                      <X className="size-3" />
                      Quitar flyer
                    </button>
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-xs font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))}
                  className="size-4 accent-[#1F4D2C]"
                />
                Mostrar inmediatamente a estudiantes en el carrusel de inicio y en /anuncios
              </label>
            </div>

            {/* Columna derecha: Vista previa en vivo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Vista previa en vivo
                </p>
                <Badge variant={form.activo ? "mint" : "neutral"}>
                  {form.activo ? "Publicado" : "Borrador oculto"}
                </Badge>
              </div>

              <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/40 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <AnuncioFlyerPreview
                  imagenUrl={form.imagen_url}
                  titulo={previewTitle}
                  tipo={form.tipo}
                  className="h-[200px] w-full"
                />

                <div className="space-y-4 bg-white p-5 dark:bg-[#1A2618]">
                  <div className="space-y-2">
                    <Badge className={previewMeta.badgeClassName}>{previewMeta.label}</Badge>
                    <h3 className="text-lg font-bold leading-snug text-[#1A1A1A] dark:text-[#F5F1E8]">
                      {previewTitle}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#6B6B6B] dark:text-[#A8B5A0]">
                      {form.descripcion ||
                        "La descripción corta aparecerá aquí para orientar al estudiante."}
                    </p>
                  </div>

                  {form.descripcion_larga && (
                    <div className="rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-3 text-xs whitespace-pre-line text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
                      <p className="mb-1 font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                        Temario completo
                      </p>
                      {form.descripcion_larga}
                    </div>
                  )}

                  <div className="divide-y divide-[#E5DFD3] rounded-lg border border-[#E5DFD3] text-xs dark:divide-[#2D3F2A] dark:border-[#2D3F2A]">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Calendar className="size-3.5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      <span className="font-semibold">Fecha:</span>
                      <span>{formatFechaMx(form.fecha_evento)}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Clock className="size-3.5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      <span className="font-semibold">Hora:</span>
                      <span className="tabular-nums">
                        {form.hora_inicio && form.hora_fin
                          ? `${form.hora_inicio} – ${form.hora_fin} hrs`
                          : form.hora_inicio
                            ? `${form.hora_inicio} hrs`
                            : "Por confirmar"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <MapPin className="size-3.5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      <span className="font-semibold">Lugar:</span>
                      <span>{form.lugar || "Por confirmar"}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <UserCheck className="size-3.5 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                      <span className="font-semibold">Ponente:</span>
                      <span>{form.ponente || "Área de Psicología TESH"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/50 p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                        Cupo
                      </span>
                      <span className="font-mono tabular-nums">
                        {previewCupoTotal
                          ? `${previewInscritos} / ${previewCupoTotal} (${previewPercent}%)`
                          : "Acceso abierto"}
                      </span>
                    </div>
                    {previewCupoTotal && (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5DFD3] dark:bg-[#2D3F2A]">
                        <div
                          className="h-full bg-[#1F4D2C]"
                          style={{ width: `${previewPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-[#E5DFD3] px-6 py-4 dark:border-[#2D3F2A]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              className="h-11"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isSaving || isUploadingFlyer}
              onClick={handleSave}
              className="h-11"
            >
              {isSaving ? "Guardando..." : editingItem ? "Guardar cambios" : "Publicar anuncio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Vista previa rápida */}
      <AnuncioDetailModal
        anuncio={previewItem}
        isOpen={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
        isInscrito={false}
        readOnlyPreview={true}
      />

      {/* Modal Confirmación de eliminación */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-lg border border-[#E5DFD3] bg-white text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Eliminar anuncio</DialogTitle>
            <DialogDescription className="text-xs text-[#6B6B6B] dark:text-[#A8B5A0]">
              ¿Seguro que deseas eliminar{" "}
              <strong className="text-[#1A1A1A] dark:text-[#F5F1E8]">
                {deleteTarget ? cleanAnuncioTitle(deleteTarget.titulo) : ""}
              </strong>
              ? Esta acción eliminará también el registro de inscripciones asociadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="h-10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="h-10"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
