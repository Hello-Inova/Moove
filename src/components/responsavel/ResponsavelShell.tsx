import type { ReactNode } from "react";
import { Link2, Users, Ticket, MapPin, Home } from "lucide-react";

import { AppHeader, type NavItem } from "@/components/layout/AppHeader";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";

const ICON_CLASS = "h-4 w-4 shrink-0";

const NAV: NavItem[] = [
  { href: "/responsavel/dashboard", label: "Meus vínculos", icon: <Link2 className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/responsavel/alunos", label: "Meus alunos", icon: <Users className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/responsavel/vincular", label: "Usar convite", icon: <Ticket className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/responsavel/buscar", label: "Ver localização", icon: <MapPin className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/responsavel/endereco", label: "Meu endereço", icon: <Home className={ICON_CLASS} aria-hidden="true" /> },
];

/**
 * O responsável não paga mais nada diretamente (quem passou a pagar por
 * aluno vinculado foi o motorista, ver `CobrancaAluno`) — por isso, ao
 * contrário do `MotoristaShell`, não há mais `AccessGate`/`TrialBanner`
 * aqui: o acesso do responsável nunca é bloqueado.
 */
export async function ResponsavelShell({ children }: { children: ReactNode }) {
  const responsavel = await getAuthenticatedResponsavel();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50 dark:bg-neutral-950 md:flex-row">
      <AppHeader
        role="responsavel"
        roleLabel="responsável"
        homeHref="/responsavel/dashboard"
        nav={NAV}
        userName={responsavel?.nome}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
