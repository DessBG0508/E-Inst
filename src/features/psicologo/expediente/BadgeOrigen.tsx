import React from "react";
import type { BadgeType } from "./types";

interface BadgeOrigenProps {
  tipo: BadgeType;
  className?: string;
}

export const BadgeOrigen: React.FC<BadgeOrigenProps> = ({ tipo, className = "" }) => {
  const styles: Record<BadgeType, string> = {
    AUTOMÁTICO: "bg-[#F5F1E8] text-[#1F4D2C] border-[#E5DFD3]",
    MIXTO: "bg-[#B8860B]/10 text-[#B8860B] border-[#B8860B]/30",
    PSICÓLOGO: "bg-[#1F4D2C] text-white border-[#1F4D2C]",
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase select-none ${styles[tipo]} ${className}`}
    >
      {tipo}
    </span>
  );
};
