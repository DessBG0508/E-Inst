import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const MAX_FLYER_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface FlyerUploadResult {
  url: string;
  fileName: string;
  isLocalFallback: boolean;
  storageWarning?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer la imagen."));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen."));
    reader.readAsDataURL(file);
  });
}

export async function uploadAnuncioFlyer(file: File): Promise<FlyerUploadResult> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Formato no compatible. Sube una imagen JPG, PNG, WebP o GIF.");
  }

  if (file.size > MAX_FLYER_SIZE_BYTES) {
    throw new Error("El flyer supera el límite de 10 MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeBase = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 40);
  const path = `flyers/${Date.now()}_${safeBase || "anuncio"}.${ext}`;

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.storage.from("anuncios-flyers").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (!error) {
        const { data } = supabase.storage.from("anuncios-flyers").getPublicUrl(path);
        if (data?.publicUrl) {
          return {
            url: data.publicUrl,
            fileName: file.name,
            isLocalFallback: false,
          };
        }
      }

      const dataUrl = await readFileAsDataUrl(file);
      return {
        url: dataUrl,
        fileName: file.name,
        isLocalFallback: true,
        storageWarning:
          error?.message || "No se pudo subir al bucket anuncios-flyers; usando copia local.",
      };
    } catch (err: unknown) {
      const dataUrl = await readFileAsDataUrl(file);
      return {
        url: dataUrl,
        fileName: file.name,
        isLocalFallback: true,
        storageWarning: err instanceof Error ? err.message : "Usando copia local temporal.",
      };
    }
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    url: dataUrl,
    fileName: file.name,
    isLocalFallback: true,
  };
}
