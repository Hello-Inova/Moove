import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: { href: string; label: string; linkLabel: string };
}) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-brand-orange-soft/40 to-white px-4 py-12 dark:from-neutral-900 dark:to-neutral-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:border-neutral-700">
        <Link href="/" className="inline-block">
          <Logo height={24} />
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-brand-navy dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && (
          <p className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {footer.label}{" "}
            <Link href={footer.href} className="font-medium text-brand-orange-dark underline underline-offset-2">
              {footer.linkLabel}
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
