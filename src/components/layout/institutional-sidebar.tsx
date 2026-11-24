import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { LogoTESH } from "./institutional-header";
import { cn } from "@/lib/utils";

export interface InstitutionalSidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | null;
  badgeClassName?: string;
}

interface InstitutionalSidebarProps {
  items: InstitutionalSidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  sectionTitle?: string;
  systemVersion?: string;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function InstitutionalSidebar({
  items,
  activeId,
  onSelect,
  ariaLabel = "Navegación institucional",
  sectionTitle = "Panel Institucional",
  systemVersion = "Equilibra TESH v2.0",
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}: InstitutionalSidebarProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onCloseMobile?.();
  };

  return (
    <>
      {isMobileOpen && onCloseMobile && (
        <div
          className="fixed inset-x-0 top-16 bottom-0 z-20 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label={ariaLabel}
        className={cn(
          "fixed top-16 bottom-0 left-0 z-30 flex w-64 flex-col justify-between border-r border-[#2D3F2A] bg-[#0F1A12] text-white/90 transition-transform duration-150 lg:translate-x-0 print:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4">
          <p className="px-5 pb-2.5 text-xs font-semibold tracking-wide text-white/50">
            {sectionTitle}
          </p>

          <nav className="flex-1 space-y-1 px-2" aria-label={ariaLabel}>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-11 w-full cursor-pointer items-center gap-3 rounded-r-lg border-l-4 px-3.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]",
                    isActive
                      ? "border-[#B8860B] bg-white/10 font-semibold text-white"
                      : "border-transparent font-medium text-white/80 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className={cn("shrink-0", isActive ? "text-[#D4A82B]" : "text-white/75")}
                  />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                    <span
                      className={cn(
                        "ml-auto inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                        item.badgeClassName || "bg-[#B8860B] text-white",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#2D3F2A] p-4 space-y-3">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/75 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8860B]"
            >
              <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
              <span>Cerrar sesión</span>
            </button>
          )}

          <div className="flex items-center justify-between gap-2.5 pt-1">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/90">{systemVersion}</p>
              <p className="truncate text-[11px] text-white/55">TESH Huixquilucan</p>
            </div>
            <LogoTESH size="sm" variant="on-dark" />
          </div>
        </div>
      </aside>
    </>
  );
}
