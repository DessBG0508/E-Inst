import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { sanitizeText } from "@/lib/security";
import { TESH_CAREERS } from "@/lib/directivo-data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InstitutionalAuthBrandPanel } from "./institutional-auth-brand-panel";

const SEMESTRES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const GRUPOS = ["A", "B", "C"] as const;

const registroSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Ingresa tu nombre completo (mínimo 3 caracteres).")
      .max(100, "El nombre no puede exceder 100 caracteres."),
    matricula: z
      .string()
      .trim()
      .regex(/^\d{8}$/, "La matrícula debe tener exactamente 8 dígitos numéricos."),
    carrera: z.enum(TESH_CAREERS, {
      errorMap: () => ({ message: "Selecciona tu carrera del TESH." }),
    }),
    semestre: z.enum(SEMESTRES, {
      errorMap: () => ({ message: "Selecciona tu semestre." }),
    }),
    grupo: z.enum(GRUPOS, {
      errorMap: () => ({ message: "Selecciona tu grupo." }),
    }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Ingresa un correo electrónico válido.")
      .refine(
        (val) => val.endsWith("@tesh.edu.mx"),
        "Debes utilizar tu correo institucional @tesh.edu.mx.",
      ),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
      .max(100, "La contraseña excede el límite permitido."),
    confirmPassword: z.string().min(1, "Confirma tu contraseña."),
    acceptPrivacy: z.boolean().refine((val) => val === true, {
      message: "Debes leer y aceptar el Aviso de Privacidad (LFPDPPP).",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

type RegistroFormValues = z.infer<typeof registroSchema>;

export function RegistroPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegistroFormValues>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      name: "",
      matricula: "",
      carrera: "Ing. en Sistemas Computacionales",
      semestre: "1",
      grupo: "A",
      email: "",
      password: "",
      confirmPassword: "",
      acceptPrivacy: false,
    },
  });

  const onSubmit = async (values: RegistroFormValues) => {
    setSubmitError(null);
    const cleanName = sanitizeText(values.name, 100);
    const cleanMatricula = sanitizeText(values.matricula, 8);
    const cleanEmail = sanitizeText(values.email, 120).toLowerCase();

    try {
      const user = await registerAccount({
        name: cleanName,
        matricula: cleanMatricula,
        email: cleanEmail,
        password: values.password,
        carrera: values.carrera,
        semestre: values.semestre,
        grupo: values.grupo,
      });

      toast.success(`Cuenta creada con éxito. Bienvenido/a, ${user.name}.`);
      try {
        localStorage.setItem("equilibra_primer_ingreso", "true");
      } catch {
        // ignore
      }
      navigate({ to: "/aviso-privacidad", replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al registrar tu cuenta. Intenta de nuevo.";
      setSubmitError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 font-sans lg:grid-cols-2">
      {/* Lado izquierdo idéntico al Login */}
      <InstitutionalAuthBrandPanel />

      {/* Lado derecho: Formulario de registro sobre crema institucional */}
      <main className="flex items-center justify-center bg-[#F5F1E8] px-4 py-10 sm:px-8 lg:px-12 dark:bg-[#0F1A12]">
        <div className="w-full max-w-md rounded-lg border border-[#E5DFD3] bg-white p-8 dark:border-[#2D3F2A] dark:bg-[#1A2618]">
          <div className="pb-4">
            <Link
              to="/login"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 -ml-2 text-xs font-semibold text-[#1F4D2C] transition-colors hover:bg-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:text-[#8FC9B5] dark:hover:bg-[#0F1A12]"
            >
              <ArrowLeft className="size-4" strokeWidth={1.75} />
              <span>Volver a iniciar sesión</span>
            </Link>
          </div>
          <div className="space-y-1.5 pb-6">
            <h1 className="font-sans text-2xl font-bold tracking-tight text-[#1F4D2C] dark:text-[#8FC9B5]">
              Crear cuenta
            </h1>
            <p className="text-sm text-[#6B6B6B] dark:text-[#A6B5A3]">
              Registro institucional para estudiantes del TESH.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-[#C8102E]/30 bg-[#FEE2E2] p-3 text-xs font-medium text-[#C8102E] dark:bg-[#3B1219] dark:text-[#FEE2E2]"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Nombre completo */}
            <div className="space-y-1.5">
              <Label
                htmlFor="reg-name"
                className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Nombre completo
              </Label>
              <Input
                id="reg-name"
                type="text"
                placeholder="Ej. Denisse Bautista García"
                autoComplete="name"
                {...register("name")}
                className="h-11 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
              />
              {errors.name && <p className="text-xs text-[#C8102E]">{errors.name.message}</p>}
            </div>

            {/* Matrícula (8 dígitos) */}
            <div className="space-y-1.5">
              <Label
                htmlFor="reg-matricula"
                className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Matrícula (8 dígitos)
              </Label>
              <Input
                id="reg-matricula"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="Ej. 20231045"
                {...register("matricula")}
                className="h-11 rounded-lg border-[#E5DFD3] bg-white text-sm tabular-nums text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
              />
              {errors.matricula && (
                <p className="text-xs text-[#C8102E]">{errors.matricula.message}</p>
              )}
            </div>

            {/* Carrera (7 carreras TESH) */}
            <div className="space-y-1.5">
              <Label
                htmlFor="reg-carrera"
                className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Carrera
              </Label>
              <Controller
                name="carrera"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="reg-carrera"
                      className="h-11 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus:ring-2 focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                    >
                      <SelectValue placeholder="Selecciona tu carrera" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                      {TESH_CAREERS.map((carrera) => (
                        <SelectItem key={carrera} value={carrera}>
                          {carrera}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.carrera && <p className="text-xs text-[#C8102E]">{errors.carrera.message}</p>}
            </div>

            {/* Semestre (1-9) y Grupo (A/B/C) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="reg-semestre"
                  className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
                >
                  Semestre
                </Label>
                <Controller
                  name="semestre"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="reg-semestre"
                        className="h-11 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus:ring-2 focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                      >
                        <SelectValue placeholder="Semestre" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        {SEMESTRES.map((sem) => (
                          <SelectItem key={sem} value={sem}>
                            {sem}º Semestre
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.semestre && (
                  <p className="text-xs text-[#C8102E]">{errors.semestre.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="reg-grupo"
                  className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
                >
                  Grupo
                </Label>
                <Controller
                  name="grupo"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="reg-grupo"
                        className="h-11 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] focus:ring-2 focus:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                      >
                        <SelectValue placeholder="Grupo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg border-[#E5DFD3] bg-white dark:border-[#2D3F2A] dark:bg-[#1A2618]">
                        {GRUPOS.map((g) => (
                          <SelectItem key={g} value={g}>
                            Grupo {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.grupo && <p className="text-xs text-[#C8102E]">{errors.grupo.message}</p>}
              </div>
            </div>

            {/* Email institucional @tesh.edu.mx */}
            <div className="space-y-1.5">
              <Label
                htmlFor="reg-email"
                className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Correo institucional (@tesh.edu.mx)
              </Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="matricula@tesh.edu.mx"
                autoComplete="email"
                {...register("email")}
                className="h-11 rounded-lg border-[#E5DFD3] bg-white text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
              />
              {errors.email && <p className="text-xs text-[#C8102E]">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div className="space-y-1.5">
              <Label
                htmlFor="reg-password"
                className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  {...register("password")}
                  className="h-11 rounded-lg border-[#E5DFD3] bg-white pr-10 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#6B6B6B] transition-colors hover:text-[#1A1A1A] dark:text-[#A6B5A3] dark:hover:text-[#F5F1E8]"
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-[#C8102E]">{errors.password.message}</p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div className="space-y-1.5">
              <Label
                htmlFor="reg-confirm-password"
                className="text-sm font-medium text-[#1A1A1A] dark:text-[#F5F1E8]"
              >
                Confirmar contraseña
              </Label>
              <div className="relative">
                <Input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                  className="h-11 rounded-lg border-[#E5DFD3] bg-white pr-10 text-sm text-[#1A1A1A] placeholder:text-[#6B6B6B]/70 focus-visible:border-[#1F4D2C] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#F5F1E8]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#6B6B6B] transition-colors hover:text-[#1A1A1A] dark:text-[#A6B5A3] dark:hover:text-[#F5F1E8]"
                  aria-label={showConfirmPassword ? "Ocultar confirmación" : "Ver confirmación"}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-[#C8102E]">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Checkbox obligatorio de Aviso de Privacidad */}
            <div className="space-y-1.5 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8]/60 p-3 dark:border-[#2D3F2A] dark:bg-[#0F1A12]">
              <Controller
                name="acceptPrivacy"
                control={control}
                render={({ field }) => (
                  <label
                    htmlFor="reg-privacy-checkbox"
                    className="flex cursor-pointer items-start gap-2.5 select-none"
                  >
                    <Checkbox
                      id="reg-privacy-checkbox"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
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
                )}
              />
              {errors.acceptPrivacy && (
                <p className="text-xs text-[#C8102E]">{errors.acceptPrivacy.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full cursor-pointer rounded-lg bg-[#1F4D2C] text-sm font-semibold text-white transition-colors hover:bg-[#4A7C59] focus-visible:ring-2 focus-visible:ring-[#1F4D2C] disabled:opacity-50"
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>

          <div className="mt-6 border-t border-[#E5DFD3] pt-5 text-center text-sm text-[#6B6B6B] dark:border-[#2D3F2A] dark:text-[#A6B5A3]">
            <span>¿Ya tienes cuenta? </span>
            <Link
              to="/login"
              className="font-semibold text-[#1F4D2C] underline underline-offset-4 hover:text-[#4A7C59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] dark:text-[#8FC9B5]"
            >
              Inicia sesión
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
