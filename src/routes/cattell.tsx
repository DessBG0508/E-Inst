import { createFileRoute } from "@tanstack/react-router";
import { CattellTestPage } from "@/features/cattell/cattell-test-page";
import { BRAND } from "@/lib/branding";

function CattellRouteComponent() {
  const { token } = Route.useSearch();
  return <CattellTestPage token={token} />;
}

export const Route = createFileRoute("/cattell")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Evaluación Educación Dual (16PF) — ${BRAND.fullName}` },
      {
        name: "description",
        content:
          "Cuestionario psicométrico Cattell (16PF) para aspirantes seleccionados del Programa Educación Dual TESH.",
      },
      {
        property: "og:title",
        content: `Evaluación Educación Dual (16PF) — ${BRAND.fullName}`,
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CattellRouteComponent,
});
