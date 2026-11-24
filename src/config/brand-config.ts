// Configuración centralizada de marca, logo e ilustraciones del emocionómetro.
// Permite cambiar, editar o sustituir iconos e imágenes fácilmente en un solo lugar.

import type { MoodId } from "@/lib/types";
import { BRAND } from "@/lib/branding";

export interface BrandConfig {
  institutionName: string;
  appName: string;
  brandSubtext: string;
  logoUrl?: string | undefined; // Logo general oficial de la plataforma
  eliAvatarUrl: string; // Mascota oficial Eli del chat
}

export const brandConfig: BrandConfig = {
  institutionName: "Tecnológico de Estudios Superiores de Huixquilucan (TESH)",
  appName: BRAND.fullName.toUpperCase(),
  brandSubtext: BRAND.tagline,
  logoUrl: "/assets/aistudio/logo-tesh_e4c36370.svg",
  eliAvatarUrl: "/assets/aistudio/mascota-robot-conejo-1024_0937f978.png",
};

export interface MoodIllustrationConfig {
  id: MoodId;
  label: string;
  src: string;
  alt: string;
  description: string;
}

export const moodIllustrationsConfig: Record<MoodId, MoodIllustrationConfig> = {
  "muy-bien": {
    id: "muy-bien",
    label: "Excelente",
    src: "/emocionometro/mood-feliz.webp",
    alt: "Estrella sonriente y luminosa",
    description: "Te sientes con energía, vitalidad y apertura emocional",
  },
  bien: {
    id: "bien",
    label: "Bien",
    src: "/emocionometro/mood-bien.webp",
    alt: "Nube suave y alegre",
    description: "Te sientes con tranquilidad y buen ánimo para tus actividades",
  },
  regular: {
    id: "regular",
    label: "Regular",
    src: "/emocionometro/mood-normal.webp",
    alt: "Nube con expresión neutra",
    description: "Te sientes en balance o con un nivel manejable de cansancio",
  },
  triste: {
    id: "triste",
    label: "Triste",
    src: "/emocionometro/mood-triste.webp",
    alt: "Gota de agua con semblante melancólico",
    description: "Sientes desánimo, vulnerabilidad o ganas de desconectar",
  },
  "muy-mal": {
    id: "muy-mal",
    label: "Muy mal",
    src: "/emocionometro/mood-muy-mal.webp",
    alt: "Nube con tormenta y relámpago",
    description: "Sientes sobrecarga, dolor emocional o angustia intensa",
  },
};
