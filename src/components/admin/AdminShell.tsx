"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Logo } from "@/components/ui/Logo";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV = [
  { href: "/admin/motoristas", label: "Motoristas" },
  { href: "/admin/responsaveis", label: "Responsáveis" },
  { href: "/admin/planos", label: "Planos" },
  { href: "/admin/auditoria", label: "Auditoria" },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 5.5h15M2.5 10h15M2.5 14.5h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Barra do admin — nav horizontal em telas médias/grandes; em telas
 * pequenas vira um botão de hambúrguer que abre os links num menu solto
 * embaixo da barra (mesma ideia do AppHeader, só que sem gaveta lateral
 * porque aqui são só 3 links + logout).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 dark:border-neutral-700">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5">
          <Link href="/admin/motoristas" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Logo height={26} />
            <span className="hidden text-sm font-medium text-neutral-500 sm:inline dark:text-neutral-400">· admin</span>
          </Link>

          {/* Nav horizontal — sm e acima */}
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                {item.label}
              </Link>
            ))}
            <div className="ml-2 flex items-center gap-2 border-l border-neutral-200 pl-3 dark:border-neutral-700">
              <ThemeToggle />
              <AdminLogoutButton />
            </div>
          </nav>

          {/* Hambúrguer — abaixo de sm */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 sm:hidden dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>

        {/* Menu solto — abaixo de sm */}
        {open && (
          <nav className="border-t border-neutral-200 px-4 py-2 sm:hidden dark:border-neutral-700">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                    active
                      ? "bg-brand-orange-soft text-brand-orange-dark dark:bg-brand-orange/15 dark:text-brand-orange-light"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 dark:border-neutral-700">
              <ThemeToggle />
              <AdminLogoutButton />
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
