import {
  ClipboardList,
  FileSpreadsheet,
  Grid3X3,
  LayoutDashboard,
  UserCheck,
  Users,
} from "lucide-react";
import {
  InstitutionalSidebar,
  type InstitutionalSidebarItem,
} from "@/components/layout/institutional-sidebar";

export type DirectivoNavSection =
  "resumen" | "estudiantes" | "tutores" | "canalizaciones" | "asignaciones" | "reportes";

interface DirectivoSidebarProps {
  activeSection: DirectivoNavSection;
  onSelectSection: (section: DirectivoNavSection) => void;
  pendingCanalizacionesCount?: number;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function DirectivoSidebar({
  activeSection,
  onSelectSection,
  pendingCanalizacionesCount = 0,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}: DirectivoSidebarProps) {
  const navItems: InstitutionalSidebarItem[] = [
    {
      id: "resumen",
      label: "Resumen ejecutivo",
      icon: LayoutDashboard,
    },
    {
      id: "estudiantes",
      label: "Estudiantes",
      icon: Users,
    },
    {
      id: "tutores",
      label: "Tutores",
      icon: UserCheck,
    },
    {
      id: "canalizaciones",
      label: "Canalizaciones",
      icon: ClipboardList,
      badge: pendingCanalizacionesCount > 0 ? pendingCanalizacionesCount : null,
      badgeClassName: "bg-[#B8860B] text-white",
    },
    {
      id: "asignaciones",
      label: "Asignaciones",
      icon: Grid3X3,
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
      onSelect={(id) => onSelectSection(id as DirectivoNavSection)}
      ariaLabel="Navegación del panel directivo"
      sectionTitle="Dirección Académica TESH"
      systemVersion="Equilibra TESH v2.0"
      onLogout={onLogout}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
    />
  );
}
