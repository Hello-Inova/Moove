"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Users, UserRound, Sparkles, ShieldCheck, Gauge, Settings, X, Menu, Headphones, type LucideIcon } from "lucide-react";

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
  { href: "/admin/chamados", label: "Chamados", icon: Headphones },
  { href: "/admin/uso-google", label: "Uso Google", icon: Gauge },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação do administrador" className="space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-brand-orange text-white shadow-sm shadow-orange-500/20"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const className = mobile
    ? "flex h-full flex-col bg-white p-5 dark:bg-neutral-950"
    : "hidden h-screen w-72 flex-col border-r border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:fixed lg:inset-y-0 lg:left-0 lg:flex";

  return (
    <aside className={className}>
      <Link href="/admin/motoristas" onClick={onNavigate} className="flex items-center gap-2 px-2">
        <Logo height={29} />
        <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Administração</span>
      </Link>
      <div className="my-6 border-t border-neutral-100 dark:border-neutral-800" />
      <AdminNav onNavigate={onNavigate} />
      <div className="mt-auto border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div className="flex items-center justify-between px-2">
          <ThemeToggle />
          <AdminLogoutButton />
        </div>
      </div>
    </aside>
  );
}

/** Layout do super admin: sidebar permanente em desktop e gaveta lateral em mobile. */
export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [usoApis, setUsoApis] = useState<ResumoApi[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/uso-google")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ResumoApi[] | null) => setUsoApis(data))
      .catch(() => setUsoApis(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const fecharComEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [open]);

  const nivel = usoApis ? piorNivel(usoApis) : "ok";
  const itensParaAvisar = usoApis?.filter((i) => i.configurada && i.percentual >= 70) ?? [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 lg:pl-72">
      <Sidebar />

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 lg:hidden">
        <Link href="/admin/motoristas" className="flex items-center gap-2">
          <Logo height={26} />
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">· admin</span>
        </Link>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          aria-label="Abrir menu de administração"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu de administração">
          <button type="button" className="absolute inset-0 bg-neutral-950/45" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[min(19rem,85vw)] shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <Sidebar mobile onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {itensParaAvisar.length > 0 && nivel !== "ok" && (
          <Link
            href="/admin/uso-google"
            className={`mb-6 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm transition hover:opacity-90 ${
              nivel === "critico"
                ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            <span className="font-medium">{nivel === "critico" ? "Perto do limite grátis do Google:" : "Atenção ao uso do Google:"}</span>
            <span>{itensParaAvisar.map((i) => `${i.label} (${i.percentual}%)`).join(" · ")} — ver detalhes</span>
          </Link>
        )}
        <main>{children}</main>
      </div>
    </div>
  );
}
