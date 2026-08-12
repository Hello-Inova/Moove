import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";

const NAV = [
  { href: "/responsavel/dashboard", label: "Meus vínculos" },
  { href: "/responsavel/alunos", label: "Meus alunos" },
  { href: "/responsavel/vincular", label: "Usar convite" },
  { href: "/responsavel/buscar", label: "Ver localização" },
  { href: "/responsavel/endereco", label: "Meu endereço" },
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
