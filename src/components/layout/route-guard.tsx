import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useAvisoPrivacidad } from "@/lib/use-aviso-privacidad";
import { rutaPorRol } from "@/lib/roles";
import { EquilibraBrand } from "@/components/ui/equilibra-brand";
import { AuroraBackground } from "@/components/effects/aurora-background";
import { PersistentSosButton } from "@/components/common/persistent-sos-button";

const PUBLIC_ROUTES = ["/login", "/registro", "/recuperar", "/reset", "/aviso-privacidad"];

/**
 * SEPARACIÓN DE ROLES INSTITUCIONALES:
 * - "directivo" y "coordinador": Panel ejecutivo de solo lectura en "/directivo" (+ "/auditoria").
 * - "jefatura": Gestión operativa de tutores y recursamiento en "/jefatura".
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { needsAcceptance, isLoading: isAvisoLoading } = useAvisoPrivacidad();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  useEffect(() => {
    if (isLoading || isAvisoLoading) return;

    // El Aviso de Privacidad es de acceso público universal para cualquier usuario o visitante
    if (pathname === "/aviso-privacidad") {
      return;
    }

    const isPublic = PUBLIC_ROUTES.includes(pathname);
    const isResetPage = pathname === "/reset";

    // 1. Sin sesión activa -> Redirigir a /login (excepto en rutas públicas)
    if (!user) {
      if (!isPublic) {
        if (typeof window !== "undefined" && pathname.startsWith("/cattell")) {
          try {
            sessionStorage.setItem(
              "equilibra_post_login_redirect",
              `${window.location.pathname}${window.location.search}`,
            );
          } catch {
            // ignore
          }
        }
        navigate({ to: "/login", replace: true });
      }
      return;
    }

    // El Aviso de Privacidad SOLO se muestra de forma forzada 1 sola vez en el PRIMER INGRESO
    // tras registrar cuenta nueva. En inicios de sesión normales el usuario entra directo a su panel.
    const esPrimerIngreso =
      typeof window !== "undefined" && localStorage.getItem("equilibra_primer_ingreso") === "true";

    if (esPrimerIngreso && needsAcceptance && !isResetPage) {
      navigate({ to: "/aviso-privacidad", replace: true });
      return;
    }

    const destinoAutorizado = rutaPorRol(user.role);

    // 3. Con sesión activa en ruta pública -> Redirigir según rol (salvo en /reset donde se actualiza contraseña)
    if (isPublic && !isResetPage && pathname !== "/aviso-privacidad") {
      navigate({ to: destinoAutorizado, replace: true });
      return;
    }

    // 3. Rol Psicólogo: puede ver /psicologo, /expedientes, /directivo, /anuncios, /encuesta, /perfil y /
    if (user.role === "psicologo") {
      if (
        !pathname.startsWith("/psicologo") &&
        !pathname.startsWith("/expedientes") &&
        !pathname.startsWith("/directivo") &&
        !pathname.startsWith("/anuncios") &&
        !pathname.startsWith("/encuesta") &&
        pathname !== "/perfil" &&
        pathname !== "/"
      ) {
        toast.info("Redirigido al panel de psicología correspondiente a tu rol.");
        navigate({ to: "/psicologo", replace: true });
      }
      return;
    }

    // 3b. Rol Médico Universitario: puede ver /medico, /anuncios, /recursos, /perfil y /
    if (user.role === "medico") {
      if (
        !pathname.startsWith("/medico") &&
        !pathname.startsWith("/anuncios") &&
        !pathname.startsWith("/recursos") &&
        pathname !== "/perfil" &&
        pathname !== "/"
      ) {
        toast.info("Redirigido al panel médico correspondiente a tu rol.");
        navigate({ to: "/medico", replace: true });
      }
      return;
    }

    // 4. Rol Jefatura de Carrera: puede ver /jefatura, /anuncios, /encuesta, /perfil y /
    if (user.role === "jefatura") {
      if (
        !pathname.startsWith("/jefatura") &&
        !pathname.startsWith("/anuncios") &&
        !pathname.startsWith("/encuesta") &&
        pathname !== "/perfil" &&
        pathname !== "/"
      ) {
        toast.info("Redirigido al panel operativo de Jefatura de Carrera.");
        navigate({ to: "/jefatura", replace: true });
      }
      return;
    }

    // 5. Roles Directivo / Coordinador: vista ejecutiva en /directivo, /auditoria, /anuncios, /encuesta, /perfil y /
    if (user.role === "directivo" || user.role === "coordinador") {
      if (
        !pathname.startsWith("/directivo") &&
        !pathname.startsWith("/auditoria") &&
        !pathname.startsWith("/anuncios") &&
        !pathname.startsWith("/encuesta") &&
        pathname !== "/perfil" &&
        pathname !== "/"
      ) {
        toast.info("Redirigido al panel directivo correspondiente a tu rol.");
        navigate({ to: "/directivo", replace: true });
      }
      return;
    }

    // 6. Rol Tutor: puede ver /tutor, /anuncios, /perfil y /
    if (user.role === "tutor") {
      if (
        !pathname.startsWith("/tutor") &&
        !pathname.startsWith("/anuncios") &&
        pathname !== "/perfil" &&
        pathname !== "/"
      ) {
        toast.info("Redirigido al panel de tutoría correspondiente a tu rol.");
        navigate({ to: "/tutor", replace: true });
      }
      return;
    }

    // 7. Rol Estudiante: puede ver /, /checkin, /alerta, /chat, /citas, /recursos, /encuesta, /anuncios, /perfil
    if (user.role === "estudiante") {
      if (
        pathname.startsWith("/psicologo") ||
        pathname.startsWith("/medico") ||
        pathname.startsWith("/directivo") ||
        pathname.startsWith("/jefatura") ||
        pathname.startsWith("/expedientes") ||
        pathname.startsWith("/auditoria") ||
        pathname.startsWith("/tutor")
      ) {
        toast.info("Esta sección es de acceso institucional.");
        navigate({ to: "/", replace: true });
      }
    }
  }, [user, isLoading, isAvisoLoading, needsAcceptance, pathname, navigate]);

  if (isLoading || (user && isAvisoLoading && pathname !== "/aviso-privacidad")) {
    return (
      <AuroraBackground>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="ethereal-card flex flex-col items-center gap-4 p-8 text-center">
            <EquilibraBrand />
            <div className="size-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Preparando tu espacio...</p>
          </div>
        </div>
      </AuroraBackground>
    );
  }

  // Si no hay usuario y no es ruta pública, no renderizar contenido protegido mientras redirige
  if (!user && !PUBLIC_ROUTES.includes(pathname)) {
    return null;
  }

  // Si hay usuario y está en una ruta que no le corresponde, no renderizar mientras redirige
  if (user) {
    const enReset = pathname === "/reset";
    const esPrimerIngreso =
      typeof window !== "undefined" && localStorage.getItem("equilibra_primer_ingreso") === "true";
    if (esPrimerIngreso && needsAcceptance && pathname !== "/aviso-privacidad" && !enReset) {
      return null;
    }
    if (PUBLIC_ROUTES.includes(pathname) && !enReset && pathname !== "/aviso-privacidad")
      return null;
    if (
      user.role === "psicologo" &&
      pathname !== "/aviso-privacidad" &&
      pathname !== "/perfil" &&
      pathname !== "/" &&
      !pathname.startsWith("/psicologo") &&
      !pathname.startsWith("/expedientes") &&
      !pathname.startsWith("/directivo") &&
      !pathname.startsWith("/anuncios") &&
      !pathname.startsWith("/encuesta")
    )
      return null;
    if (
      user.role === "medico" &&
      pathname !== "/aviso-privacidad" &&
      pathname !== "/perfil" &&
      pathname !== "/" &&
      !pathname.startsWith("/medico") &&
      !pathname.startsWith("/anuncios") &&
      !pathname.startsWith("/recursos")
    )
      return null;
    if (
      user.role === "jefatura" &&
      pathname !== "/aviso-privacidad" &&
      pathname !== "/perfil" &&
      pathname !== "/" &&
      !pathname.startsWith("/jefatura") &&
      !pathname.startsWith("/anuncios") &&
      !pathname.startsWith("/encuesta")
    )
      return null;
    if (
      (user.role === "directivo" || user.role === "coordinador") &&
      pathname !== "/aviso-privacidad" &&
      pathname !== "/perfil" &&
      pathname !== "/" &&
      !pathname.startsWith("/directivo") &&
      !pathname.startsWith("/auditoria") &&
      !pathname.startsWith("/anuncios") &&
      !pathname.startsWith("/encuesta")
    )
      return null;
    if (
      user.role === "tutor" &&
      pathname !== "/aviso-privacidad" &&
      pathname !== "/perfil" &&
      pathname !== "/" &&
      !pathname.startsWith("/tutor") &&
      !pathname.startsWith("/anuncios")
    )
      return null;
    if (
      user.role === "estudiante" &&
      pathname !== "/aviso-privacidad" &&
      (pathname.startsWith("/psicologo") ||
        pathname.startsWith("/medico") ||
        pathname.startsWith("/directivo") ||
        pathname.startsWith("/jefatura") ||
        pathname.startsWith("/expedientes") ||
        pathname.startsWith("/auditoria") ||
        pathname.startsWith("/tutor"))
    )
      return null;
  }

  return (
    <>
      {children}
      <PersistentSosButton />
    </>
  );
}
