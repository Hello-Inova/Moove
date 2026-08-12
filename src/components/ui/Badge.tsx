import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const VARIANTS = {
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
} as const;

export function Badge({
  children,
  variant = "neutral",
  icon: Icon,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  icon?: LucideIcon;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${VARIANTS[variant]}`}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
