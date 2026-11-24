import { useState } from "react";
import { brandConfig } from "@/config/brand-config";

export function InstitutionalAuthBrandPanel() {
  const [logoFailed, setLogoFailed] = useState(false);
  const [eliFailed, setEliFailed] = useState(false);

  return (
    <aside className="flex flex-col items-center justify-between bg-[#1F4D2C] px-8 py-10 text-center text-[#F5F1E8] lg:min-h-screen lg:px-12 lg:py-14">
      <div className="hidden lg:block" aria-hidden="true" />

      <div className="flex max-w-sm flex-col items-center space-y-6">
        {!logoFailed && brandConfig.logoUrl ? (
          <img
            src={brandConfig.logoUrl}
            alt="Logotipo Tecnológico de Estudios Superiores de Huixquilucan"
            height={120}
            decoding="async"
            onError={() => setLogoFailed(true)}
            className="h-[120px] w-auto object-contain brightness-0 invert opacity-95"
          />
        ) : (
          <div className="flex h-[120px] items-center justify-center">
            <span className="text-3xl font-bold tracking-tight text-[#F5F1E8]">TESH</span>
          </div>
        )}

        {!eliFailed && brandConfig.eliAvatarUrl ? (
          <img
            src={brandConfig.eliAvatarUrl}
            alt="Mascota Eli de Equilibra TESH"
            width={200}
            height={200}
            decoding="async"
            onError={() => setEliFailed(true)}
            className="size-[200px] object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,0.28)]"
          />
        ) : (
          <div className="flex size-[200px] items-center justify-center rounded-lg border border-[#F5F1E8]/20 text-sm font-semibold text-[#F5F1E8]">
            Eli · Equilibra TESH
          </div>
        )}

        <p className="font-sans text-lg font-semibold leading-snug text-[#F5F1E8] sm:text-xl">
          Equilibra TESH — Bienestar emocional universitario
        </p>
      </div>

      <p className="pt-8 font-sans text-xs font-medium tracking-wide text-[#F5F1E8]/80 sm:text-sm">
        Tecnológico de Estudios Superiores de Huixquilucan
      </p>
    </aside>
  );
}
