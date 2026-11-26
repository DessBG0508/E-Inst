import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, AlertCircle, GraduationCap, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { rutaPorRol } from "@/lib/roles";
import { DEMO_MODE } from "@/lib/mock-data";
import {
  sanitizeText,
  isValidEmail,
  getLoginRateLimitState,
  recordFailedLoginAttempt,
  resetLoginAttempts,
} from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstitutionalAuthBrandPanel } from "./institutional-auth-brand-panel";

export function LoginPage() {
  const { login, loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [lockoutSeconds, setLockoutSeconds] = useState<number>(() => {
    return getLoginRateLimitState().remainingSeconds;
  });

  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setErrorMessage(null);
          toast.info("Puedes volver a intentar iniciar sesión.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const isLocked = lockoutSeconds > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isLocked) {
      toast.warning(`Por seguridad, espera ${lockoutSeconds} segundos antes de volver a intentar.`);
      return;
    }

    const cleanEmail = sanitizeText(email, 120).toLowerCase();
    const cleanPassword = password.slice(0, 100);

    if (!cleanEmail) {
      setErrorMessage("Por favor ingresa tu correo institucional o registrado.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setErrorMessage("Por favor ingresa un formato de correo electrónico válido.");
      return;
    }

    if (!cleanPassword) {
      setErrorMessage("Por favor ingresa tu contraseña.");
      return;
    }

    if (!acceptedPrivacy) {
      setErrorMessage("Debes leer y aceptar el Aviso de Privacidad para continuar.");
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await login(cleanEmail, cleanPassword);
      resetLoginAttempts();
      try {
        localStorage.removeItem("equilibra_primer_ingreso");
      } catch {
        // ignore
      }
      toast.success(`Bienvenido/a de nuevo, ${user.name}`);
      if (user.role === "estudiante" && typeof window !== "undefined") {
        const pendingRedirect = sessionStorage.getItem("equilibra_post_login_redirect");
        if (pendingRedirect && pendingRedirect.startsWith("/cattell")) {
          sessionStorage.removeItem("equilibra_post_login_redirect");
          window.location.replace(pendingRedirect);
          return;
        }
      }
      navigate({ to: rutaPorRol(user.role), replace: true });
    } catch (err: unknown) {
      const rateState = recordFailedLoginAttempt(5, 30);
      if (rateState.isLocked) {
        setLockoutSeconds(rateState.remainingSeconds);
        const lockMsg = `Hemos pausado los intentos durante ${rateState.remainingSeconds} segundos por seguridad. Podrás intentarlo de nuevo en breve.`;
        setErrorMessage(lockMsg);
        toast.error(lockMsg);
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : "No se pudo iniciar sesión. Verifica tus credenciales.";
        const attemptsLeft = 5 - rateState.attemptsCount;
        const warning =
          attemptsLeft <= 2
            ? `${msg} (${attemptsLeft} intentos restantes antes de una pausa de seguridad).`
            : msg;
        setErrorMessage(warning);
        toast.error(warning);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateDemo = (
    role: "estudiante" | "psicologo" | "medico" | "directivo" | "jefatura" | "tutor",
  ) => {
    setErrorMessage(null);
    const demoUser = loginAsDemo(role);
    resetLoginAttempts();
    try {
      localStorage.removeItem("equilibra_primer_ingreso");
    } catch {
      // ignore
    }
    toast.success(`Modo demostración activado: ${demoUser.name}`);
    navigate({ to: rutaPorRol(demoUser.role), replace: true });
  };

  return (
    <div className="grid min-h-screen grid-cols-1 font-sans lg:grid-cols-2">
      {/* Lado izquierdo: Identidad institucional verde bosque */}
      <InstitutionalAuthBrandPanel />

      {/* Lado derecho: Formulario sobre crema institucional */}
      <main className="flex items-center justify-center bg-[#F5F1E8] px-4 py-10 sm:px-8 lg:px-12 dark:bg-[#0F1A12]">
        <div className="w-full max-w-md rounded-lg border border-[#E5DFD3] bg-white p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="space-y-1.5 pb-6">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-[#1F4D2C] dark:text-[#8FC9B5]">
              Iniciar sesión
            </h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
              Accede a tu cuenta institucional de Equilibra TESH.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[#C8102E]/30 bg-[#FEE2E2] p-3 text-xs font-medium text-[#C8102E] dark:bg-[#3B1219] dark:text-[#FEE2E2]"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="login-email"
                className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Correo electrónico institucional
              </Label>
              <Input
                id="login-email"
                type="email"
                placeholder="usuario@tesh.edu.mx"
                value={email}
                disabled={isSubmitting || isLocked}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="login-password"
                  className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
                >
                  Contraseña
                </Label>
                <Link
                  to="/recuperar"
                  className="text-xs font-medium text-[#1F4D2C] underline underline-offset-4 hover:text-[#4A7C59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:text-[#8FC9B5]"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  disabled={isSubmitting || isLocked}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 rounded-lg border-[#E5DFD3] bg-white pr-10 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                  required
                />
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#6B6B6B] transition-colors hover:text-[#1A1A1A] disabled:opacity-40 dark:text-[#A6B5A3] dark:hover:text-[#F5F1E8]"
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {/* Checkbox obligatorio LFPDPPP */}
            <div className="space-y-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
              <label
                htmlFor="login-privacy-checkbox"
                className="flex cursor-pointer items-start gap-2.5 select-none"
              >
                <Checkbox
                  id="login-privacy-checkbox"
                  checked={acceptedPrivacy}
                  onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                  className="mt-0.5 size-4 rounded-sm border-[#1F4D2C] data-[state=checked]:bg-[#1F4D2C] data-[state=checked]:text-white focus-visible:ring-2 focus-visible:ring-[#1F4D2C]"
                />
                <span className="text-xs leading-relaxed text-[#1A1A1A] dark:text-[#F5F1E8]">
                  He leído y acepto el{" "}
                  <a
                    href="/aviso-privacidad?mode=consulta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#1F4D2C] underline underline-offset-4 hover:text-[#4A7C59] dark:text-[#8FC9B5]"
                  >
                    Aviso de Privacidad
                  </a>{" "}
                  (LFPDPPP).
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isLocked}
              className="h-11 w-full cursor-pointer rounded-lg bg-[#1F4D2C] text-sm font-semibold text-white transition-colors hover:bg-[#4A7C59] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] disabled:opacity-50"
            >
              {isSubmitting
                ? "Verificando..."
                : isLocked
                  ? `Acceso pausado (${lockoutSeconds}s)`
                  : "Entrar"}
            </Button>
          </form>

          {DEMO_MODE && (
            <div className="mt-6 space-y-2.5 border-t border-[#E5DFD3] pt-5 dark:border-[#2D3F2A]">
              <p className="text-xs font-semibold text-[#6B6B6B] dark:text-[#A6B5A3]">
                Acceso rápido de demostración
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleActivateDemo("estudiante")}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 text-left text-xs font-medium text-[#1A1A1A] transition-colors hover:border-[#1F4D2C] hover:bg-[#E0F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  <GraduationCap
                    className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
                    strokeWidth={1.75}
                  />
                  <span className="truncate">Estudiante</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleActivateDemo("psicologo")}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 text-left text-xs font-medium text-[#1A1A1A] transition-colors hover:border-[#1F4D2C] hover:bg-[#E0F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  <GraduationCap
                    className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
                    strokeWidth={1.75}
                  />
                  <span className="truncate">Psicóloga</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleActivateDemo("tutor")}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 text-left text-xs font-medium text-[#1A1A1A] transition-colors hover:border-[#1F4D2C] hover:bg-[#E0F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  <GraduationCap
                    className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
                    strokeWidth={1.75}
                  />
                  <span className="truncate">Tutor</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleActivateDemo("jefatura")}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 text-left text-xs font-medium text-[#1A1A1A] transition-colors hover:border-[#1F4D2C] hover:bg-[#E0F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  <GraduationCap
                    className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
                    strokeWidth={1.75}
                  />
                  <span className="truncate">Jefatura</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleActivateDemo("medico")}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 text-left text-xs font-medium text-[#1A1A1A] transition-colors hover:border-[#1F4D2C] hover:bg-[#E0F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  <Stethoscope
                    className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
                    strokeWidth={1.75}
                  />
                  <span className="truncate">Médico</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleActivateDemo("directivo")}
                  className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-2.5 text-left text-xs font-medium text-[#1A1A1A] transition-colors hover:border-[#1F4D2C] hover:bg-[#E0F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                >
                  <GraduationCap
                    className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]"
                    strokeWidth={1.75}
                  />
                  <span className="truncate">Directivo (Solo lectura)</span>
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-[#E5DFD3] pt-5 text-center text-sm text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
            <span>¿No tienes cuenta? </span>
            <Link
              to="/registro"
              className="font-semibold text-[#1F4D2C] underline underline-offset-4 hover:text-[#4A7C59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:text-[#8FC9B5]"
            >
              Regístrate
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
