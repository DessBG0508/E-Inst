import { useEffect, useState } from "react";
import { BellRing, CalendarDays, Info, Presentation } from "lucide-react";
import { ANUNCIO_TIPO_META, cleanAnuncioTitle, type AnuncioTipo } from "./types";

interface AnuncioFlyerPreviewProps {
  imagenUrl?: string | null;
  titulo: string;
  tipo: AnuncioTipo;
  className?: string;
}

const TIPO_ICONS: Record<AnuncioTipo, typeof Presentation> = {
  taller: Presentation,
  evento: CalendarDays,
  informativo: Info,
  recordatorio: BellRing,
};

export function AnuncioFlyerPreview({
  imagenUrl,
  titulo,
  tipo,
  className = "h-44 w-full",
}: AnuncioFlyerPreviewProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imagenUrl]);

  const meta = ANUNCIO_TIPO_META[tipo] || ANUNCIO_TIPO_META.taller;
  const Icon = TIPO_ICONS[tipo] || Presentation;
  const cleanTitle = cleanAnuncioTitle(titulo || "Actividad TESH");

  if (imagenUrl && !imgError) {
    return (
      <div className={`relative overflow-hidden bg-[#0F1A12] ${className}`}>
        <img
          src={imagenUrl}
          alt={`Flyer: ${cleanTitle}`}
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden p-4 text-white ${className}`}
      style={{ backgroundColor: meta.hexColor }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/85">
          Equilibra TESH · {meta.label}
        </span>
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15 text-white">
          <Icon className="size-4" strokeWidth={1.75} />
        </div>
      </div>

      <p className="line-clamp-2 text-sm font-bold leading-snug text-white">{cleanTitle}</p>
    </div>
  );
}
