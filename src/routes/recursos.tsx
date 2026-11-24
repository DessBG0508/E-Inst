import { createFileRoute } from "@tanstack/react-router";
import { RecursosPage } from "@/features/recursos/recursos-page";
import { BRAND } from "@/lib/branding";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: `Recursos de bienestar — ${BRAND.fullName}` },
      {
        name: "description",
        content:
          "Biblioteca de recursos de bienestar, ejercicios interactivos y psicoeducación del TESH.",
      },
      { property: "og:title", content: `Recursos de bienestar — ${BRAND.fullName}` },
      {
        property: "og:description",
        content:
          "Biblioteca de recursos de bienestar, ejercicios interactivos y psicoeducación del TESH.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecursosPage,
});
