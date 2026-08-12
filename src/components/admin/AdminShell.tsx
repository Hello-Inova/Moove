"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Users, UserRound, Sparkles, ShieldCheck, Gauge, type LucideIcon } from "lucide-react";

import { Logo } from "@/components/ui/Logo";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { ResumoApi } from "@/lib/uso-api-externa";
import { piorNivel } from "@/lib/uso-api-externa-cores";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/motoristas", label: "Motoristas", icon: Users },
  { href: "/admin/responsaveis", label: "Responsáveis", icon: UserRound },
  { href: "/admin/planos", label: "Planos", icon: Sparkles },
  { href: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/admin/uso-google", label: "Uso Google", icon: Gauge },
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
 * porque aqui são poucos links + logout). Também busca o resumo de uso das
 * APIs do Google (ver /admin/uso-google) e mostra um banner de aviso logo
 * abaixo do header, em qualquer página do admin, quando alguma delas está
 * perto do limite gratuito mensal.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [usoApis, setUsoApis] = useState<ResumoApi[] | null>(null);

  // Aviso de limite gratuito do Google — busca uma vez ao montar (qualquer
  // página admin, já que todas passam por aqui) e fica quieto se falhar:
  // é só um aviso, não pode travar o painel se a rota de uso cair.
  useEffect(() => {
    fetch("/api/admin/uso-google")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ResumoApi[] | null) => setUsoApis(data))
      .catch(() => setUsoApis(null));
  }, []);

  const nivel = usoApis ? piorNivel(usoApis) : "ok";
  const itensParaAvisar = usoApis?.filter((i) => i.configurada && i.percentual >= 70) ?? [];

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
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
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
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    active
                      ? "bg-brand-orange-soft text-brand-orange-dark dark:bg-brand-orange/15 dark:text-brand-orange-light"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
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

      {itensParaAvisar.length > 0 && nivel !== "ok" && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-4">
          <Link
            href="/admin/uso-google"
            className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm transition hover:opacity-90 ${
              nivel === "critico"
                ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            <span className="font-medium">
              {nivel === "critico" ? "Perto do limite grátis do Google:" : "Atenção ao uso do Google:"}
            </span>
            <span>
              {itensParaAvisar.map((i) => `${i.label} (${i.percentual}%)`).join(" · ")} — ver detalhes
            </span>
          </Link>
        </div>
      )}

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
