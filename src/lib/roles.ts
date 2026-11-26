/**
 * Catálogo y mapeo oficial de roles de la Base de Datos (enum app_role en Supabase).
 *
 * SEPARACIÓN DE RESPONSABILIDADES:
 * - "directivo" y "coordinador": Vista ejecutiva de solo lectura en "/directivo".
 * - "jefatura": Gestión operativa de tutores, asignaciones por periodo y recursamiento en "/jefatura".
 */

export type AppRole =
  "estudiante" | "psicologo" | "medico" | "directivo" | "jefatura" | "coordinador" | "tutor";

export function rutaPorRol(rol?: string | null): string {
  switch (rol) {
    case "psicologo":
      return "/psicologo";
    case "medico":
      return "/medico";
    case "jefatura":
      return "/jefatura";
    case "directivo":
    case "coordinador":
      return "/directivo";
    case "tutor":
      return "/tutor";
    default:
      return "/";
  }
}
