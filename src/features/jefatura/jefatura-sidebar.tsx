import {
  ArrowRightLeft,
  ClipboardList,
  FileSpreadsheet,
  Grid3X3,
  LayoutDashboard,
} from "lucide-react";
import {
  InstitutionalSidebar,
  type InstitutionalSidebarItem,
} from "@/components/layout/institutional-sidebar";

export type JefaturaNavSection =
  "dashboard" | "asignaciones" | "recursan" | "canalizaciones" | "reportes";

interface JefaturaSidebarProps {
  activeSection: JefaturaNavSection;
  onSelectSection: (section: JefaturaNavSection) => void;
  pendingCanalizacionesCount?: number;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function JefaturaSidebar({
  activeSection,
  onSelectSection,
  pendingCanalizacionesCount = 0,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}: JefaturaSidebarProps) {
  const navItems: InstitutionalSidebarItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "asignaciones",
      label: "Asignar tutores",
      icon: Grid3X3,
    },
    {
      id: "recursan",
      label: "Estudiantes que recursan",
      icon: ArrowRightLeft,
    },
    {
      id: "canalizaciones",
      label: "Canalizaciones",
      icon: ClipboardList,
      badge: pendingCanalizacionesCount > 0 ? pendingCanalizacionesCount : null,
      badgeClassName: "bg-[#B8860B] text-white",
    },
    {
      id: "reportes",
      label: "Reportes",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <InstitutionalSidebar
      items={navItems}
      activeId={activeSection}
      onSelect={(id) => onSelectSection(id as JefaturaNavSection)}
      ariaLabel="Navegación del panel de Jefatura de Carrera"
      sectionTitle="Jefatura de Carrera TESH"
      systemVersion="Equilibra TESH v2.0"
      onLogout={onLogout}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
    />
  );
}
