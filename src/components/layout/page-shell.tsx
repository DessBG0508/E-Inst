import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { AuroraBackground } from "@/components/effects/aurora-background";
import { Button } from "@/components/ui/button";
import { AppHeader } from "./app-header";

interface PageShellProps {
  children: ReactNode;
  showAppHeader?: boolean;
  showFallbackLogout?: boolean;
}

export function PageShell({
  children,
  showAppHeader = true,
  showFallbackLogout = true,
}: PageShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.info("Has cerrado sesión.");
    navigate({ to: "/login", replace: true });
  };

  return (
    <AuroraBackground>
      {showAppHeader && <AppHeader />}
      <div
        className={`relative mx-auto min-h-screen w-full max-w-6xl px-4 pb-16 sm:px-7 lg:px-10 ${
          showAppHeader ? "pt-6 sm:pt-8" : ""
        }`}
      >
        {!showAppHeader && showFallbackLogout && user ? (
          <div className="flex justify-end pt-4 pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 rounded-xl border-border/70 bg-card/80 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              title="Cerrar sesión activa"
            >
              <LogOut className="size-3.5" />
              <span>Cerrar sesión</span>
            </Button>
          </div>
        ) : null}
        {children}
      </div>
    </AuroraBackground>
  );
}
