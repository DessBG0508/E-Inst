import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-[#E5DFD3] bg-white px-3.5 py-2 text-sm text-[#1A1A1A] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#1A1A1A] placeholder:text-[#6B6B6B]/60 focus:border-[#1F4D2C] focus:outline-none focus:ring-2 focus:ring-[#1F4D2C] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-white dark:file:text-white dark:placeholder:text-[#A8B5A0]/60 dark:focus:border-[#4A7C59] dark:focus:ring-[#4A7C59]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
