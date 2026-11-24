import {
  LayoutDashboard,
  ShieldAlert,
  FolderOpen,
  Calendar,
  FileText,
  Star,
  UserPlus,
  Library,
} from "lucide-react";
import {
  InstitutionalSidebar,
  type InstitutionalSidebarItem,
} from "@/components/layout/institutional-sidebar";

export type PsychologistNavSection =
  | "resumen"
  | "alertas"
  | "expedientes"
  | "agenda"
  | "bitacora"
  | "encuestas"
  | "canalizaciones"
  | "recursos";

interface PsychologistSidebarProps {
  activeSection: PsychologistNavSection;
  onSelectSection: (section: PsychologistNavSection) => void;
  redAlertsCount: number;
  activeAppointmentsCount: number;
  pendingCanalizacionesCount?: number;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function PsychologistSidebar({
  activeSection,
  onSelectSection,
  redAlertsCount,
  activeAppointmentsCount,
  pendingCanalizacionesCount = 0,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}: PsychologistSidebarProps) {
  const navItems: InstitutionalSidebarItem[] = [
    {
      id: "resumen",
      label: "Resumen",
      icon: LayoutDashboard,
    },
    {
      id: "alertas",
      label: "Alertas",
      icon: ShieldAlert,
      badge: redAlertsCount > 0 ? redAlertsCount : null,
      badgeClassName: "bg-[#C8102E] text-white",
    },
    {
      id: "expedientes",
      label: "Expedientes",
      icon: FolderOpen,
    },
    {
      id: "agenda",
      label: "Agenda",
      icon: Calendar,
      badge: activeAppointmentsCount > 0 ? activeAppointmentsCount : null,
      badgeClassName: "bg-[#4A7C59] text-white",
    },
    {
      id: "bitacora",
      label: "Bitácora",
      icon: FileText,
    },
    {
      id: "encuestas",
      label: "Encuestas",
      icon: Star,
    },
    {
      id: "canalizaciones",
      label: "Canalizaciones",
      icon: UserPlus,
      badge: pendingCanalizacionesCount > 0 ? pendingCanalizacionesCount : null,
      badgeClassName: "bg-[#B8860B] text-white",
    },
    {
      id: "recursos",
      label: "Recursos y Videos",
      icon: Library,
    },
  ];

  return (
    <InstitutionalSidebar
      items={navItems}
      activeId={activeSection}
      onSelect={(id) => onSelectSection(id as PsychologistNavSection)}
      ariaLabel="Navegación del panel de psicología"
      sectionTitle="Área Psicológica TESH"
      systemVersion="Equilibra TESH v2.0"
      onLogout={onLogout}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
    />
  );
}
