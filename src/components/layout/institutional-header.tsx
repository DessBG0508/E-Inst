import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, ChevronRight, Home, LogOut, Menu, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brandConfig } from "@/config/brand-config";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export interface InstitutionalBreadcrumbItem {
  label: string;
  onClick?: () => void;
  href?: string;
}

interface LogoTESHProps {
  size?: "sm" | "md";
  variant?: "default" | "on-dark";
  className?: string;
}

export function LogoTESH({ size = "md", variant = "on-dark", className = "" }: LogoTESHProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const containerSize = size === "sm" ? "h-7 px-1.5 py-0.5" : "h-10 px-2 py-1";
  const imgSize = size === "sm" ? "h-5 w-auto" : "h-8 w-auto";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg transition-colors",
        containerSize,
        variant === "on-dark"
          ? "border border-[#E5DFD3]/30 bg-[#F5F1E8]"
          : "border border-[#E5DFD3] bg-white",
        className,
      )}
    >
      {!imgFailed && brandConfig.logoUrl ? (
        <img
          src={brandConfig.logoUrl}
          alt="Logo TESH Equilibra"
          height={size === "sm" ? 20 : 32}
          decoding="async"
          onError={() => setImgFailed(true)}
          className={cn(imgSize, "object-contain")}
        />
      ) : (
        <span className="text-xs font-bold tracking-tight text-[#1F4D2C]">TESH</span>
      )}
    </div>
  );
}

interface InstitutionalBreadcrumbsProps {
  items: InstitutionalBreadcrumbItem[];
  onHomeClick?: () => void;
  className?: string;
}

export function InstitutionalBreadcrumbs({
  items,
  onHomeClick,
  className = "",
}: InstitutionalBreadcrumbsProps) {
  const navigate = useNavigate();

  const handleHome = () => {
    if (onHomeClick) {
      onHomeClick();
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div
      className={cn(
        "h-10 w-full border-b border-[#E5DFD3] bg-[#F5F1E8] dark:border-[#2D3F2A] dark:bg-[#1A2618]",
        className,
      )}
    >
      <nav
        aria-label="Ruta de navegación"
        className="mx-auto flex h-full w-full max-w-7xl items-center gap-2 overflow-x-auto px-4 text-sm text-[#6B6B6B] no-scrollbar sm:px-6 lg:px-8 dark:text-[#A6B5A3]"
      >
        <button
          type="button"
          onClick={handleHome}
          aria-label="Inicio del módulo"
          className="inline-flex shrink-0 cursor-pointer items-center text-[#6B6B6B] transition-colors hover:text-[#1F4D2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:text-[#A6B5A3] dark:hover:text-[#8FC9B5]"
        >
          <Home className="size-4" strokeWidth={1.75} />
        </button>

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <div key={`${item.label}-${idx}`} className="flex min-w-0 shrink-0 items-center gap-2">
              <ChevronRight
                className="size-3.5 shrink-0 text-[#6B6B6B]/70 dark:text-[#A6B5A3]/70"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {isLast ? (
                <span className="max-w-[220px] truncate font-semibold text-[#1F4D2C] sm:max-w-sm dark:text-[#8FC9B5]">
                  {item.label}
                </span>
              ) : item.onClick || item.href ? (
                <button
                  type="button"
                  onClick={() => {
                    if (item.onClick) {
                      item.onClick();
                    } else if (item.href) {
                      navigate({ to: item.href });
                    }
                  }}
                  className="cursor-pointer whitespace-nowrap transition-colors hover:text-[#1F4D2C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:hover:text-[#8FC9B5]"
                >
                  {item.label}
                </button>
              ) : (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

export interface InstitutionalHeaderProps {
  moduleTitle: string;
  breadcrumbs: InstitutionalBreadcrumbItem[];
  onHomeClick?: () => void;
  showCrisisButton?: boolean;
  onCrisisClick?: () => void;
  actions?: ReactNode;
  roleLabel?: string;
  showSidebarToggle?: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  sidebarOffsetClassName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  psicologo: "Psicólogo Clínico",
  tutor: "Tutor de Grupo",
  jefatura: "Jefatura de Carrera",
  coordinador: "Coordinador Directivo",
  directivo: "Directivo TESH",
  estudiante: "Estudiante",
};

export function InstitutionalHeader({
  moduleTitle,
  breadcrumbs,
  onHomeClick,
  showCrisisButton = false,
  onCrisisClick,
  actions,
  roleLabel,
  showSidebarToggle = false,
  isSidebarOpen = false,
  onToggleSidebar,
  sidebarOffsetClassName = "",
}: InstitutionalHeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name || "Personal Institucional TESH";
  const displayEmail = user?.email || "institucional@tesh.edu.mx";
  const displayRole =
    roleLabel || (user?.role ? ROLE_LABELS[user.role] || user.role : "Personal TESH");

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    toast.info("Has cerrado sesión institucional.");
    navigate({ to: "/login", replace: true });
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-white/15 bg-[#1F4D2C] text-white print:hidden">
        <div className="flex h-full w-full items-center justify-between gap-3 px-4 sm:px-6">
          {/* Izquierda: Menú móvil opcional + Logo TESH (40px) + Título del módulo */}
          <div className="flex min-w-0 items-center gap-3">
            {showSidebarToggle && onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={isSidebarOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
                aria-expanded={isSidebarOpen}
                className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:hidden"
              >
                {isSidebarOpen ? (
                  <X className="size-5" strokeWidth={1.75} />
                ) : (
                  <Menu className="size-5" strokeWidth={1.75} />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onHomeClick}
              className="flex shrink-0 cursor-pointer items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Inicio Equilibra TESH"
            >
              <LogoTESH size="md" variant="on-dark" />
            </button>

            <span className="hidden h-6 w-px shrink-0 bg-white/20 sm:block" aria-hidden="true" />

            <h1 className="truncate text-base font-semibold tracking-tight text-white">
              {moduleTitle}
            </h1>
          </div>

          {/* Derecha: Utilidades del módulo + Botón Crisis (solo módulos con paciente) + Avatar Dropdown */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {actions && <div className="flex items-center gap-2">{actions}</div>}

            {showCrisisButton && (
              <Button
                type="button"
                onClick={onCrisisClick}
                className="h-11 shrink-0 cursor-pointer gap-2 rounded-lg border border-white/15 bg-[#C8102E] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#9B0C24] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F4D2C] sm:px-4"
              >
                <AlertTriangle className="size-[18px] shrink-0" strokeWidth={1.75} />
                <span>Crisis</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Menú de usuario institucional"
                  className="flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-lg border border-white/15 bg-white/10 px-2.5 text-left text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Avatar className="size-8 rounded-lg border border-white/25">
                    <AvatarFallback className="rounded-lg bg-[#B8860B] text-xs font-semibold text-white">
                      {initials || "TE"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 max-w-[150px] md:block">
                    <p className="truncate text-xs font-semibold leading-tight text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-[11px] leading-tight text-white/75">
                      {displayRole}
                    </p>
                  </div>
                  <ChevronDown
                    className="hidden size-4 shrink-0 text-white/80 md:block"
                    strokeWidth={1.75}
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-64 rounded-lg border border-[#E5DFD3] bg-white p-2 text-[#1A1A1A] shadow-none dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
              >
                <DropdownMenuLabel className="space-y-1 p-2">
                  <p className="truncate text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    {displayName}
                  </p>
                  <p className="truncate text-xs font-normal text-[#6B6B6B] dark:text-[#A6B5A3]">
                    {displayEmail}
                  </p>
                  <p className="pt-0.5 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    {displayRole}
                  </p>
                </DropdownMenuLabel>

                <DropdownMenuSeparator className="bg-[#E5DFD3] dark:bg-[#2D3F2A]" />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="h-10 cursor-pointer gap-2 rounded-lg text-sm font-semibold text-[#C8102E] focus:bg-[#FEE2E2] focus:text-[#C8102E] dark:focus:bg-[#3B1219] dark:focus:text-[#FEE2E2]"
                >
                  <LogOut className="size-[18px]" strokeWidth={1.75} />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Espaciador para la barra superior fija h-16 */}
      <div className="h-16 shrink-0 print:hidden" aria-hidden="true" />

      {/* Barra de Breadcrumbs h-10 debajo del header */}
      <InstitutionalBreadcrumbs
        items={breadcrumbs}
        onHomeClick={onHomeClick}
        className={cn("print:hidden", sidebarOffsetClassName)}
      />
    </>
  );
}
