import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 9.5L10 3l7 6.5M4.5 8.5V16a1 1 0 001 1h3v-4.5h3V17h3a1 1 0 001-1V8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      <div className="absolute left-4 top-4">
        <Link
          href="/"
          aria-label="Voltar para a seleção de perfil"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <HomeIcon />
        </Link>
      </div>
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
