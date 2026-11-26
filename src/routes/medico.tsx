import { createFileRoute } from "@tanstack/react-router";
import { MedicoDashboard } from "@/features/medico/medico-dashboard";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/medico")({
  head: () => ({
    meta: [
      { title: `Panel Servicio Médico — ${BRAND.fullName}` },
      {
        name: "description",
        content:
          "Portal del Servicio Médico Universitario del TESH para consulta física, agenda médica y canalización a Psicología.",
      },
      { property: "og:title", content: `Panel Servicio Médico — ${BRAND.fullName}` },
      {
        property: "og:description",
        content:
          "Portal del Servicio Médico Universitario del TESH para consulta física, agenda médica y canalización a Psicología.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MedicoDashboard,
});
