import { createFileRoute } from "@tanstack/react-router";
import { PsychologistDashboard } from "@/features/psicologo/psychologist-dashboard";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/psicologo_/recursos")({
  head: () => ({
    meta: [
      { title: `Gestión de recursos — ${BRAND.fullName}` },
      {
        name: "description",
        content: `Administración psicoeducativa de recursos y videos en ${BRAND.fullName}.`,
      },
      { property: "og:title", content: `Gestión de recursos — ${BRAND.fullName}` },
      {
        property: "og:description",
        content: "Panel de psicología para crear, editar y publicar recursos de bienestar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <PsychologistDashboard initialSection="recursos" />,
});
