import { AlertTriangle, ClipboardList, FolderKanban, UserCircle, Users } from "lucide-react";
import {
  InstitutionalSidebar,
  type InstitutionalSidebarItem,
} from "@/components/layout/institutional-sidebar";

export type TutorNavSection = "grupos" | "estudiantes" | "alertas" | "canalizaciones" | "perfil";

interface TutorSidebarProps {
  activeSection: TutorNavSection;
  onSelectSection: (section: TutorNavSection) => void;
  absenceAlertsCount: number;
  pendingCanalizacionesCount?: number;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function TutorSidebar({
  activeSection,
  onSelectSection,
  absenceAlertsCount,
  pendingCanalizacionesCount = 0,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}: TutorSidebarProps) {
  const navItems: InstitutionalSidebarItem[] = [
    {
      id: "grupos",
      label: "Mis grupos",
      icon: FolderKanban,
    },
    {
      id: "estudiantes",
      label: "Estudiantes",
      icon: Users,
    },
    {
      id: "alertas",
      label: "Alertas de inasistencia",
      icon: AlertTriangle,
      badge: absenceAlertsCount > 0 ? absenceAlertsCount : null,
      badgeClassName: "bg-[#C8102E] text-white",
    },
    {
      id: "canalizaciones",
      label: "Canalizaciones",
      icon: ClipboardList,
      badge: pendingCanalizacionesCount > 0 ? pendingCanalizacionesCount : null,
      badgeClassName: "bg-[#B8860B] text-white",
    },
    {
      id: "perfil",
      label: "Mi perfil",
      icon: UserCircle,
    },
  ];

  return (
    <InstitutionalSidebar
      items={navItems}
      activeId={activeSection}
      onSelect={(id) => onSelectSection(id as TutorNavSection)}
      ariaLabel="Navegación del panel de tutoría"
      sectionTitle="Tutoría Académica TESH"
      systemVersion="Equilibra TESH v2.0"
      onLogout={onLogout}
      isMobileOpen={isMobileOpen}
      onCloseMobile={onCloseMobile}
    />
  );
}
