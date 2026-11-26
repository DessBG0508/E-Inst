import { Calendar, ClipboardList, LayoutDashboard, Library, UserPlus, Users } from "lucide-react";
import {
  InstitutionalSidebar,
  type InstitutionalSidebarItem,
} from "@/components/layout/institutional-sidebar";

export type MedicoNavSection =
  "resumen" | "pacientes" | "agenda" | "canalizaciones" | "expedientes" | "recursos";

interface MedicoSidebarProps {
  activeSection: MedicoNavSection;
  onSelectSection: (section: MedicoNavSection) => void;
  activeAppointmentsCount: number;
  pendingCanalizacionesCount?: number;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function MedicoSidebar({
  activeSection,
  onSelectSection,
  activeAppointmentsCount,
  pendingCanalizacionesCount = 0,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}: MedicoSidebarProps) {
  const navItems: InstitutionalSidebarItem[] = [
    {
      id: "resumen",
      label: "Resumen",
      icon: LayoutDashboard,
    },
    {
      id: "pacientes",
      label: "Pacientes",
      icon: Users,
    },
    {
      id: "agenda",
      label: "Agenda",
      icon: Calendar,
      badge: activeAppointmentsCount > 0 ? activeAppointmentsCount : null,
      badgeClassName: "bg-[#4A7C59] text-white",
    },
    {
      id: "canalizaciones",
      label: "Canalizaciones",
      icon: UserPlus,
      badge: pendingCanalizacionesCount > 0 ? pendingCanalizacionesCount : null,
      badgeClassName: "bg-[#B8860B] text-white",
    },
    {
      id: "expedientes",
      label: "Expedientes médicos",
      icon: ClipboardList,
    },
    {
      id: "recursos",
      label: "Recursos",
      icon: Library,
    },
  ];

  return (
    <InstitutionalSidebar
      items={navItems}
      activeId={activeSection}
      onSelect={(id) => onSelectSection(id as MedicoNavSection)}
      ariaLabel="Navegación del panel de Servicio Médico"
      sectionTitle="Servicio Médico TESH"
      systemVersion="Equilibra TESH v2.0"
      onLogout={onLogout}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
    />
  );
}
