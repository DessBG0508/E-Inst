import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  FolderHeart,
  HeartPulse,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Shield,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NotificationsCenter } from "@/components/notifications/notifications-center";
import { LogoTESH } from "./institutional-header";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

function getNavItemsForRole(role?: string): NavItem[] {
  switch (role) {
    case "psicologo":
      return [
        { label: "Panel", to: "/psicologo", icon: LayoutDashboard },
        { label: "Expedientes", to: "/expedientes", icon: FolderHeart },
        { label: "Anuncios", to: "/anuncios", icon: Megaphone },
        { label: "Recursos", to: "/recursos", icon: BookOpen },
      ];
    case "medico":
      return [
        { label: "Consultorio", to: "/medico", icon: Stethoscope },
        { label: "Anuncios", to: "/anuncios", icon: Megaphone },
        { label: "Perfil", to: "/perfil", icon: User },
      ];
    case "tutor":
      return [
        { label: "Tutoría", to: "/tutor", icon: Users },
        { label: "Anuncios", to: "/anuncios", icon: Megaphone },
        { label: "Perfil", to: "/perfil", icon: User },
      ];
    case "jefatura":
      return [
        { label: "Jefatura", to: "/jefatura", icon: Building2 },
        { label: "Anuncios", to: "/anuncios", icon: Megaphone },
        { label: "Perfil", to: "/perfil", icon: User },
      ];
    case "directivo":
    case "coordinador":
      return [
        { label: "Dirección", to: "/directivo", icon: BarChart3 },
        { label: "Auditoría", to: "/auditoria", icon: ShieldCheck },
        { label: "Anuncios", to: "/anuncios", icon: Megaphone },
      ];
    default:
      return [
        { label: "Inicio", to: "/", icon: Home },
        { label: "Chat Eli", to: "/chat", icon: MessageSquare },
        { label: "Check-in", to: "/checkin", icon: HeartPulse },
        { label: "Citas", to: "/citas", icon: Calendar },
        { label: "Recursos", to: "/recursos", icon: BookOpen },
        { label: "Avisos", to: "/anuncios", icon: Megaphone },
      ];
  }
}

const ROLE_LABELS: Record<string, string> = {
  estudiante: "Estudiante",
  psicologo: "Psicólogo Clínico",
  medico: "Médico Universitario",
  tutor: "Tutor de Grupo",
  jefatura: "Jefatura de Carrera",
  directivo: "Directivo TESH",
  coordinador: "Coordinador Directivo",
};

function getInitials(name?: string) {
  if (!name) return "EQ";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const second = parts[1]?.charAt(0) ?? "";
  if (first && second) return `${first}${second}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "EQ";
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = getNavItemsForRole(user?.role);

  const handleLogout = async () => {
    await logout();
    toast.info("Has cerrado sesión.");
    navigate({ to: "/login", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-white/15 bg-[#1F4D2C] text-white print:hidden">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zona 1: Marca institucional */}
        <div className="flex min-w-0 items-center gap-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Abrir menú de navegación"
                className="size-9 shrink-0 cursor-pointer rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white md:hidden"
              >
                <Menu className="size-5" strokeWidth={1.75} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-r border-[#E5DFD3] bg-[#F5F1E8] p-5 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
            >
              <SheetHeader className="border-b border-[#E5DFD3] pb-4 text-left dark:border-[#2D3F2A]">
                <SheetTitle className="flex items-center gap-2.5 text-base font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  <LogoTESH size="sm" variant="default" />
                  <span>Equilibra TESH</span>
                </SheetTitle>
                <SheetDescription className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Navegación institucional
                </SheetDescription>
              </SheetHeader>

              <nav aria-label="Menú móvil institucional" className="mt-4 flex flex-col gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-[#1F4D2C] text-white"
                          : "text-[#1A1A1A] hover:bg-white dark:text-[#F5F1E8] dark:hover:bg-[#1A2618]"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LogoTESH size="md" variant="on-dark" />
            <span className="whitespace-nowrap font-display text-base font-bold tracking-tight text-white sm:text-lg">
              Equilibra TESH
            </span>
          </Link>
        </div>

        {/* Zona 2: Enlaces de navegación institucional con iconos */}
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-1 md:flex lg:gap-1.5"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:text-sm ${
                  isActive
                    ? "bg-white/18 text-white underline decoration-[#8FC9B5] decoration-2 underline-offset-4"
                    : "text-white/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Zona 3: Utilidades y menú de cuenta */}
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle className="size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none backdrop-blur-none hover:scale-100 hover:border-white/30 hover:bg-white/15 [&_svg]:size-[18px] [&_svg]:text-white" />

          <NotificationsCenter
            role={user?.role || "estudiante"}
            triggerClassName="relative size-9 rounded-lg border border-white/20 bg-white/10 text-white shadow-none hover:bg-white/15 hover:text-white"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-white/20 bg-white/10 p-1 pr-2 text-left text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Menú de usuario"
              >
                <Avatar className="size-7 rounded-md">
                  <AvatarFallback className="rounded-md bg-[#B8860B] text-xs font-bold text-white">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[110px] truncate text-xs font-semibold text-white xl:inline">
                  {user?.name?.split(" ")[0] || "Cuenta"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-60 rounded-lg border border-[#E5DFD3] bg-white p-2 text-[#1A1A1A] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
            >
              <DropdownMenuLabel className="space-y-1 p-2">
                <p className="truncate text-sm font-bold text-[#1A1A1A] dark:text-[#F5F1E8]">
                  {user?.name || "Usuario TESH"}
                </p>
                <p className="truncate text-xs font-normal text-[#6B6B6B] dark:text-[#A6B5A3]">
                  {user?.email}
                </p>
                <p className="pt-0.5 text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  {user?.role ? ROLE_LABELS[user.role] || user.role : "Estudiante"}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#E5DFD3] dark:bg-[#2D3F2A]" />
              <DropdownMenuItem
                onClick={() => navigate({ to: "/perfil" })}
                className="cursor-pointer gap-2 rounded-md text-xs font-semibold focus:bg-[#F5F1E8] dark:focus:bg-[#0F1A12]"
              >
                <User className="size-4" strokeWidth={1.75} />
                <span>Mi Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate({ to: "/anuncios" })}
                className="cursor-pointer gap-2 rounded-md text-xs font-semibold focus:bg-[#F5F1E8] dark:focus:bg-[#0F1A12]"
              >
                <Megaphone className="size-4" strokeWidth={1.75} />
                <span>Anuncios TESH</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate({ to: "/aviso-privacidad", search: { mode: "consulta" } })}
                className="cursor-pointer gap-2 rounded-md text-xs font-semibold focus:bg-[#F5F1E8] dark:focus:bg-[#0F1A12]"
              >
                <Shield className="size-4" strokeWidth={1.75} />
                <span>Aviso de Privacidad</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#E5DFD3] dark:bg-[#2D3F2A]" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer gap-2 rounded-md text-xs font-semibold text-[#C8102E] focus:bg-[#FEE2E2] focus:text-[#C8102E] dark:focus:bg-[#3B1219] dark:focus:text-[#FEE2E2]"
              >
                <LogOut className="size-4" strokeWidth={1.75} />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
