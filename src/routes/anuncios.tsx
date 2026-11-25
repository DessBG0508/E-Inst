import { createFileRoute } from "@tanstack/react-router";
import { AnunciosPage } from "@/features/anuncios/anuncios-page";
import { BRAND } from "@/lib/branding";

interface AnunciosSearch {
  anuncio?: string;
}

export const Route = createFileRoute("/anuncios")({
  validateSearch: (search: Record<string, unknown>): AnunciosSearch => ({
    anuncio:
      typeof search.anuncio === "string" && search.anuncio.trim() ? search.anuncio : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Anuncios y talleres — ${BRAND.fullName}` },
      {
        name: "description",
        content:
          "Convocatorias, talleres psicoeducativos, eventos y recordatorios de bienestar estudiantil del TESH.",
      },
      { property: "og:title", content: `Anuncios y talleres — ${BRAND.fullName}` },
      {
        property: "og:description",
        content:
          "Convocatorias, talleres psicoeducativos, eventos y recordatorios de bienestar estudiantil del TESH.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnunciosRouteComponent,
});

function AnunciosRouteComponent() {
  const { anuncio } = Route.useSearch();
  return <AnunciosPage initialAnuncioId={anuncio} />;
}
