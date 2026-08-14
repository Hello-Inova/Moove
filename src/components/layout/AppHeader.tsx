"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/ui/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EditProfileModal } from "@/components/ui/EditProfileModal";

// `icon` é um elemento já renderizado (ReactNode), não o componente em si —
// MotoristaShell/ResponsavelShell são Server Components e AppHeader é
// Client Component ("use client" abaixo); passar a referência da função do
// ícone (ex: `icon: MapPin`) através dessa fronteira quebra em produção
// ("Functions cannot be passed directly to Client Components"). Um elemento
// React já instanciado (ex: `icon: <MapPin className="h-4 w-4" />`) é só
// dado serializável, então atravessa a fronteira sem problema — mesmo
// mecanismo usado por `children`.
export type NavItem = { href: string; label: string; icon?: ReactNode };

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
 * Menu lateral (sidebar) — fixo na lateral esquerda em telas médias/grandes,
 * e uma gaveta deslizante em telas pequenas (com barra superior só pro botão
 * de abrir). Mostra nome + papel de quem está logado no topo, ajuda a
 * orientar em qual conta a pessoa está.
 */
export function AppHeader({
  role,
  roleLabel,
  homeHref,
  nav,
  userName,
}: {
  role: "motorista" | "responsavel";
  roleLabel: string;
  homeHref: string;
  nav: NavItem[];
  userName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [nomeAtual, setNomeAtual] = useState(userName ?? "");
  const pathname = usePathname();

  // As páginas do motorista moram num layout compartilhado (ver
  // src/app/motorista/(app)/layout.tsx), então o LocationSharingProvider —
  // e o GPS — continuam ativos ao navegar entre elas; não precisa mais de
  // confirmação nem de interceptar a navegação aqui, só fechar a gaveta
  // mobile e deixar o <Link> normal cuidar do resto.
  function handleNavClick() {
    setOpen(false);
  }

  const iniciais = (nomeAtual ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const sidebarConteudo = (
    <div className="flex h-full flex-col">
      <Link href={homeHref} className="flex items-center gap-2 px-4 py-4" onClick={handleNavClick}>
        <Logo height={26} />
      </Link>

      {nomeAtual && (
        <button
          type="button"
          onClick={() => setPerfilAberto(true)}
          className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-neutral-100 px-3 py-2.5 text-left transition hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange text-sm font-semibold text-white">
            {iniciais || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{nomeAtual}</p>
            <p className="text-xs capitalize text-neutral-500 dark:text-neutral-400">{roleLabel} · editar perfil</p>
          </div>
        </button>
      )}

      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-orange-soft text-brand-orange-dark dark:bg-brand-orange/15 dark:text-brand-orange-light"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <ThemeToggle />
        <LogoutButton role={role} />
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar fixa — md e acima */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-neutral-200 bg-white md:block dark:border-neutral-700 dark:bg-neutral-950">
        {sidebarConteudo}
      </aside>

      {/* Barra superior + gaveta — abaixo de md */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-white/70 md:hidden dark:border-neutral-800 dark:bg-neutral-950/90 dark:supports-[backdrop-filter]:bg-neutral-950/70">
        <Link href={homeHref} className="flex items-center gap-2" onClick={handleNavClick}>
          <Logo height={24} />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl dark:bg-neutral-950">
            {sidebarConteudo}
          </div>
        </div>
      )}

      {perfilAberto && (
        <EditProfileModal
          role={role}
          onClose={() => setPerfilAberto(false)}
          onSaved={(nome) => setNomeAtual(nome)}
        />
      )}
    </>
  );
}
