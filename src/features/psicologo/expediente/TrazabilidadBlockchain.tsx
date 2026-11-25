import React from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { BadgeOrigen } from "./BadgeOrigen";
import type { TrazabilidadData } from "./types";

interface TrazabilidadBlockchainProps {
  trazabilidad: TrazabilidadData;
  nombrePsicologo?: string;
  txHashUrl?: string;
}

export const TrazabilidadBlockchain: React.FC<TrazabilidadBlockchainProps> = ({
  trazabilidad,
  nombrePsicologo,
  txHashUrl = "https://amoy.polygonscan.com",
}) => {
  const hashExpediente =
    trazabilidad.hash_expediente ||
    "b39d53c832f8817b269139b9eee358e4ec3fc8b57240cd5896dc9f36bd8b94b5";
  const hashPrevio =
    trazabilidad.hash_previo || "290c15c14f5364eec5ae6b472820036161cb7b067b051b318c3bc102067d31a0";
  const ancladoEn = trazabilidad.anclado_en || "0x7f3b...e8a4 (tx hash) — 30-oct-2026 14:23 UTC";
  const liberadoPor =
    trazabilidad.liberado_por ||
    (nombrePsicologo ? `Dr(a). ${nombrePsicologo}` : "Psicología Clínica TESH");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 rounded-lg bg-[#1F4D2C] px-4 py-3 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-xs font-bold text-white">
            10
          </span>
          <h3 className="text-base font-semibold tracking-tight text-white">
            Trazabilidad y auditoría
          </h3>
        </div>
        <span className="text-xs font-normal text-white/80 sm:ml-2">
          Registro automático de integridad del expediente (solo lectura)
        </span>
      </div>

      <div className="rounded-lg border border-[#E5DFD3] bg-white p-5 dark:border-[#2D3F2A] dark:bg-[#1A2618] sm:p-6">
        <div className="mb-4 flex items-center justify-between border-b border-[#E5DFD3] pb-3 dark:border-[#2D3F2A]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6B6B] dark:text-[#A6B5A3]">
            Bitácora criptográfica institucional
          </span>
          <BadgeOrigen tipo="AUTOMÁTICO" />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="traz-hash"
              className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
            >
              Hash del expediente
            </label>
            <input
              id="traz-hash"
              type="text"
              readOnly
              value={hashExpediente}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 font-mono text-xs text-[#6B6B6B] cursor-default focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="traz-hash-previo"
              className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
            >
              Hash previo en cadena
            </label>
            <input
              id="traz-hash-previo"
              type="text"
              readOnly
              value={hashPrevio}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 font-mono text-xs text-[#6B6B6B] cursor-default focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="traz-anclado"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Anclado en Polygon Amoy
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 text-xs font-medium text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]">
                <ShieldCheck className="size-4 shrink-0 text-[#1F4D2C] dark:text-[#8FC9B5]" />
                <span className="truncate">{ancladoEn}</span>
                <a
                  href={txHashUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex text-[#1F4D2C] hover:underline dark:text-[#8FC9B5] print:hidden"
                  aria-label="Ver transacción en explorador Polygon"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="traz-liberado-por"
                className="text-sm font-semibold text-[#1F4D2C] dark:text-[#8FC9B5]"
              >
                Responsable clínico
              </label>
              <input
                id="traz-liberado-por"
                type="text"
                readOnly
                value={liberadoPor}
                className="w-full rounded-lg border border-[#E5DFD3] bg-[#F5F1E8] px-3 py-2 text-sm font-medium text-[#6B6B6B] cursor-default focus:outline-none dark:border-[#2D3F2A] dark:bg-[#0F1A12] dark:text-[#A6B5A3]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
