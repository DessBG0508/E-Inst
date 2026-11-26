import { createFileRoute } from "@tanstack/react-router";
import { JefaturaDashboard } from "@/features/jefatura/jefatura-dashboard";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/jefatura")({
  head: () => ({
    meta: [
      { title: `Panel operativo de Jefatura de Carrera — ${BRAND.fullName}` },
      {
        name: "description",
        content: `Asignación de tutores por periodo, gestión de recursamiento y seguimiento de canalizaciones en ${BRAND.fullName}.`,
      },
      {
        property: "og:title",
        content: `Panel operativo de Jefatura de Carrera — ${BRAND.fullName}`,
      },
      {
        property: "og:description",
        content:
          "Gestión operativa de tutores académicos, asignaciones por periodo y estudiantes que recursan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JefaturaDashboard,
});
