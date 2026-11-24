import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0F1A12] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#1F4D2C] text-white hover:bg-[#4A7C59]",
        accent: "bg-[#B8860B] text-white hover:bg-[#D4A82B]",
        danger: "bg-[#C8102E] text-white hover:bg-[#9B0C24]",
        calm: "bg-[#7B6FD8] text-white hover:bg-[#6A5FC9] dark:bg-[#A89AE8] dark:text-[#0F1A12] dark:hover:bg-[#9584DE]",
        outline:
          "border border-[#E5DFD3] bg-transparent text-[#1F4D2C] hover:bg-[#F5F1E8] dark:border-[#2D3F2A] dark:text-[#F5F1E8] dark:hover:bg-[#1A2618]",
        ghost:
          "bg-transparent text-[#1F4D2C] hover:bg-[#F5F1E8] dark:text-[#F5F1E8] dark:hover:bg-[#1A2618]",
        destructive: "bg-[#C8102E] text-white hover:bg-[#9B0C24]",
        secondary:
          "border border-[#E5DFD3] bg-[#F5F1E8] text-[#1A1A1A] hover:bg-[#EDE8DC] dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:hover:bg-[#223120]",
        link: "text-[#1F4D2C] underline-offset-4 hover:underline dark:text-[#8FC9B5]",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 px-3.5",
        lg: "h-14 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
