"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useLocationSharingContext } from "@/contexts/LocationSharingContext";

type NavItem = { href: string; label: string };

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

export function AppHeader({
  role,
  roleLabel,
  homeHref,
  nav,
}: {
  role: "motorista" | "responsavel";
  roleLabel: string;
  homeHref: string;
  nav: NavItem[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { confirmAndRun } = useLocationSharingContext();

  // Enquanto o motorista compartilha a localização, sair da rota atual
  // (inclusive pelo próprio menu) precisa passar pelo alerta de confirmação
  // — navegar embora desmonta o painel de compartilhamento e encerra o GPS.
  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    setOpen(false);
    confirmAndRun(() => router.push(href));
  }

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
        <Link href={homeHref} className="flex items-center gap-2" onClick={(e) => handleNavClick(e, homeHref)}>
          <Logo height={26} />
          <span className="hidden text-sm font-medium text-neutral-500 sm:inline">· {roleLabel}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-orange-soft text-brand-orange-dark"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="ml-2 border-l border-neutral-200 pl-3">
            <LogoutButton role={role} />
          </div>
        </nav>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-neutral-200 bg-white px-4 pb-3 pt-2 md:hidden">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-brand-orange-soft text-brand-orange-dark"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-neutral-200 pt-3">
            <LogoutButton role={role} />
          </div>
        </nav>
      )}
    </header>
  );
}
