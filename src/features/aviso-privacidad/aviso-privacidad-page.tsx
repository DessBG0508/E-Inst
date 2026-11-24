import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { brandConfig } from "@/config/brand-config";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { rutaPorRol } from "@/lib/roles";
import {
  useAvisoPrivacidad,
  AVISO_PRIVACIDAD_VERSION_ACTUAL,
  getStoredAviso,
} from "@/lib/use-aviso-privacidad";
import { AVISO_PRIVACIDAD_METADATA, AVISO_PRIVACIDAD_SECCIONES } from "./aviso-privacidad-content";

export function AvisoPrivacidadPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    needsAcceptance,
    isLoading: isAvisoLoading,
    acceptAviso,
    fechaAceptacion,
    versionAceptada,
  } = useAvisoPrivacidad();

  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const queryMode = searchParams.get("mode");

  const userStoredAviso = user?.id ? getStoredAviso(user.id, user.email) : null;
  const userYaAcepto =
    userStoredAviso?.aceptado === true &&
    userStoredAviso.version === AVISO_PRIVACIDAD_VERSION_ACTUAL;

  const isConsultationMode =
    queryMode === "consulta" ||
    !user ||
    (Boolean(user) &&
      !needsAcceptance &&
      !isAvisoLoading &&
      (userYaAcepto || Boolean(versionAceptada)) &&
      queryMode !== "forzar");

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [modoAcompanamientoConsent, setModoAcompanamientoConsent] = useState<boolean>(() => {
    try {
      return localStorage.getItem("equilibra_modo_acompanamiento") === "true";
    } catch {
      return false;
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (isConsultationMode) {
      setAcceptedTerms(true);
    }
  }, [isConsultationMode]);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate({ to: user ? rutaPorRol(user.role) : "/login" });
  };

  const handleAcceptAndContinue = async () => {
    if (!acceptedTerms) {
      toast.warning("Debes marcar la casilla de aceptación para continuar.");
      return;
    }

    try {
      setIsSubmitting(true);
      await acceptAviso(AVISO_PRIVACIDAD_VERSION_ACTUAL, modoAcompanamientoConsent);
      try {
        localStorage.removeItem("equilibra_primer_ingreso");
      } catch {
        // ignore
      }
      toast.success("Aviso de Privacidad aceptado. Bienvenido/a a Equilibra TESH.");
      const destino = user ? rutaPorRol(user.role) : "/";
      navigate({ to: destino, replace: true });
    } catch {
      toast.error("Ocurrió un error al procesar tu consentimiento. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      if (user) {
        await logout();
      }
    } catch (e) {
      console.error("Error al cerrar sesión al no aceptar aviso:", e);
    }
    toast.info("Has decidido no aceptar el Aviso de Privacidad. Sesión finalizada.");
    navigate({ to: "/login", replace: true });
  };

  const formattedFecha = fechaAceptacion
    ? new Date(fechaAceptacion).toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#F5F1E8] px-4 py-8 font-sans text-[#1A1A1A] sm:px-6 sm:py-10 dark:bg-[#0F1A12] dark:text-[#F5F1E8]">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Botón Volver arriba a la izquierda */}
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="h-11 cursor-pointer gap-2 rounded-lg border-[#E5DFD3] bg-white px-4 text-sm font-semibold text-[#1F4D2C] transition-colors hover:bg-[#E0F0E8] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#8FC9B5]"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            <span>Volver</span>
          </Button>
        </div>

        {/* Header pequeño con logo TESH + título */}
        <header className="flex items-center gap-3.5 rounded-lg border border-[#E5DFD3] bg-white px-6 py-4 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          {!logoFailed && brandConfig.logoUrl ? (
            <img
              src={brandConfig.logoUrl}
              alt="Logo TESH"
              height={40}
              decoding="async"
              onError={() => setLogoFailed(true)}
              className="h-10 w-auto shrink-0 object-contain"
            />
          ) : (
            <span className="text-sm font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">TESH</span>
          )}
          <div className="min-w-0">
            <h1 className="font-sans text-lg font-bold text-[#1F4D2C] sm:text-xl dark:text-[#8FC9B5]">
              Aviso de Privacidad — Equilibra TESH
            </h1>
            <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
              Ley Federal de Protección de Datos Personales en Posesión de los Particulares
              (LFPDPPP)
            </p>
          </div>
        </header>

        {/* Estado informativo si ya fue aceptado */}
        {user && isConsultationMode && (
          <div className="flex items-center gap-3 rounded-lg border border-[#1F4D2C]/25 bg-[#E0F0E8] px-5 py-3.5 text-sm text-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#172B21] dark:text-[#8FC9B5]">
            <CheckCircle2 className="size-5 shrink-0" strokeWidth={1.75} />
            <p className="text-xs sm:text-sm">
              {formattedFecha
                ? `Consentimiento registrado el ${formattedFecha} (versión ${versionAceptada || AVISO_PRIVACIDAD_VERSION_ACTUAL}).`
                : "Tu consentimiento al Aviso de Privacidad se encuentra vigente."}
            </p>
          </div>
        )}

        {/* Card principal */}
        <main className="rounded-lg border border-[#E5DFD3] bg-white p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="space-y-8 divide-y divide-[#E5DFD3] dark:divide-[#2D3F2A]">
            {AVISO_PRIVACIDAD_SECCIONES.map((seccion) => (
              <article
                key={seccion.id}
                id={seccion.id}
                className={seccion.number > 1 ? "pt-7" : ""}
              >
                <h2 className="mb-3 font-sans text-base font-bold text-[#1F4D2C] sm:text-lg dark:text-[#8FC9B5]">
                  {seccion.number}. {seccion.title}
                </h2>
                {seccion.content}
              </article>
            ))}
          </div>

          {/* Bloque obligatorio de aceptación en primer login */}
          {user && !isConsultationMode && (
            <section
              aria-label="Consentimiento y aceptación inicial"
              className="mt-8 space-y-5 border-t border-[#E5DFD3] pt-8 dark:border-[#2D3F2A]"
            >
              <div className="space-y-1">
                <h2 className="font-sans text-base font-bold text-[#1F4D2C] dark:text-[#8FC9B5]">
                  Consentimiento inicial requerido
                </h2>
                <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                  Confirma tu aceptación para activar tu cuenta institucional.
                </p>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
                <div className="space-y-1 pr-2">
                  <span className="text-sm font-semibold text-[#1A1A1A] dark:text-[#F5F1E8]">
                    Compartir mi tamizaje con Bienestar (Modo Acompañamiento)
                  </span>
                  <p className="text-xs text-[#6B6B6B] dark:text-[#A6B5A3]">
                    Permite al equipo de psicología del TESH dar seguimiento a tus resultados.
                    Reversible desde tu perfil.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 self-end sm:self-auto">
                  <Switch
                    id="modo-acompaniamiento-toggle"
                    checked={modoAcompanamientoConsent}
                    onCheckedChange={setModoAcompanamientoConsent}
                    aria-label="Activar Modo Acompañamiento institucional"
                  />
                  <span className="text-xs font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]">
                    {modoAcompanamientoConsent ? "Activado" : "Privado"}
                  </span>
                </div>
              </div>

              <label
                htmlFor="accept-privacy-terms"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/40 p-4 select-none dark:border-[#2D3F2A] dark:bg-[#0F1A12]"
              >
                <Checkbox
                  id="accept-privacy-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-0.5 size-4 rounded-sm border-[#1F4D2C] data-[state=checked]:bg-[#1F4D2C] data-[state=checked]:text-white focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
                />
                <span className="text-sm font-medium leading-snug text-[#1A1A1A] dark:text-[#F5F1E8]">
                  He leído y acepto el Aviso de Privacidad Integral de Equilibra TESH.
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="h-11 cursor-pointer rounded-lg border-[#E5DFD3] bg-white px-5 text-sm font-semibold text-[#1A1A1A] hover:bg-[#F5F1E8] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]"
                >
                  No aceptar
                </Button>

                <Button
                  type="button"
                  onClick={handleAcceptAndContinue}
                  disabled={!acceptedTerms || isSubmitting}
                  className="h-11 cursor-pointer gap-2 rounded-lg bg-[#1F4D2C] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#4A7C59] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] disabled:opacity-50"
                >
                  <span>{isSubmitting ? "Procesando..." : "Aceptar y continuar"}</span>
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </Button>
              </div>
            </section>
          )}
        </main>

        {/* Footer con fecha de última actualización y contacto */}
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#E5DFD3] pt-4 text-xs text-[#6B6B6B] sm:flex-row dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
          <span>
            Última actualización: {AVISO_PRIVACIDAD_METADATA.fechaVigencia} · Versión{" "}
            {AVISO_PRIVACIDAD_METADATA.version}
          </span>
          <span>
            Contacto:{" "}
            <a
              href="mailto:privacidad@tesh.edu.mx"
              className="font-semibold text-[#1F4D2C] underline underline-offset-4 hover:text-[#4A7C59] dark:text-[#8FC9B5]"
            >
              privacidad@tesh.edu.mx
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
