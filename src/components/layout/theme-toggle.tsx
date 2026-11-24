import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={cn(
        "relative inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border border-[#E5DFD3] bg-white text-[#1F4D2C] transition-colors hover:bg-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D2C] focus-visible:ring-offset-2 dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8] dark:hover:bg-[#223120]",
        className,
      )}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}
