import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  HeartPulse,
  Home,
  Megaphone,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";

export interface StudentTopBarProps {
  title: string;
  backTo?: string;
  onBack?: () => void;
  showCrisisButton?: boolean;
  showThemeToggle?: boolean;
  rightActions?: ReactNode;
}

const STUDENT_NAV_ITEMS = [
  { label: "Inicio", to: "/", icon: Home },
  { label: "Chat Eli", to: "/chat", icon: MessageSquare },
  { label: "Check-in", to: "/checkin", icon: HeartPulse },
  { label: "Citas", to: "/citas", icon: Calendar },
  { label: "Recursos", to: "/recursos", icon: BookOpen },
  { label: "Avisos", to: "/anuncios", icon: Megaphone },
] as const;

export function StudentTopBar({
  title,
  backTo = "/",
  onBack,
  showCrisisButton = false,
  showThemeToggle = true,
  rightActions,
}: StudentTopBarProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      navigate({ to: backTo });
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-white/15 bg-[#1F4D2C] text-white print:hidden">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6">
        {/* Izquierda: Regreso + Título */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            aria-label="Volver a la pantalla anterior"
            className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-lg bg-[#F5F1E8] px-3 text-xs font-semibold text-[#1F4D2C] transition-colors hover:bg-white hover:text-[#1F4D2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:text-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-[#1F4D2C]" strokeWidth={2} />
            <span className="hidden sm:inline">Volver</span>
          </Button>
          <span className="hidden h-5 w-px shrink-0 bg-white/20 sm:block" aria-hidden="true" />
          <h1 className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
            {title}
          </h1>
        </div>

        {/* Centro: Barra de navegación institucional con iconos (desktop) */}
        <nav aria-label="Navegación institucional" className="hidden items-center gap-1 lg:flex">
          {STUDENT_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  isActive
                    ? "bg-white/18 text-white underline decoration-[#8FC9B5] decoration-2 underline-offset-4"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Derecha: Acciones opcionales, Tema y Botón Crisis */}
        <div className="flex shrink-0 items-center gap-2">
          {rightActions}

          {showThemeToggle && (
            <ThemeToggle
              className={`${
                showCrisisButton ? "hidden sm:inline-flex" : "inline-flex"
              } size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none backdrop-blur-none hover:scale-100 hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white`}
            />
          )}

          {showCrisisButton && (
            <Button
              type="button"
              size="sm"
              onClick={() => navigate({ to: "/alerta" })}
              className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-lg bg-[#C8102E] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#9B0C24] focus-visible:ring-2 focus-visible:ring-white"
            >
              <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
              <span>Crisis</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
