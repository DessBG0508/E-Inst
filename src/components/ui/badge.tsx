import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F4D2C] focus:ring-offset-2 dark:focus:ring-offset-[#0F1A12]",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-[#1F4D2C] text-white hover:bg-[#4A7C59]",
        accent: "border-transparent bg-[#B8860B] text-white hover:bg-[#D4A82B]",
        danger: "border-transparent bg-[#C8102E] text-white hover:bg-[#9B0C24]",
        calm: "border-transparent bg-[#7B6FD8] text-white hover:bg-[#6A5FC9] dark:bg-[#A89AE8] dark:text-[#0F1A12]",
        mint: "border-transparent bg-[#8FC9B5] text-white",
        muted:
          "border-[#E5DFD3] bg-[#F5F1E8] text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A8B5A0]",
        default: "border-transparent bg-[#1F4D2C] text-white hover:bg-[#4A7C59]",
        secondary:
          "border-[#E5DFD3] bg-[#F5F1E8] text-[#6B6B6B] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#A8B5A0]",
        destructive: "border-transparent bg-[#C8102E] text-white hover:bg-[#9B0C24]",
        outline:
          "border-[#E5DFD3] bg-transparent text-[#1A1A1A] dark:border-[#2D3F2A] dark:text-[#F5F1E8]",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
