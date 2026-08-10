import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";

const NAV = [
  { href: "/responsavel/dashboard", label: "Meus vínculos" },
  { href: "/responsavel/alunos", label: "Meus alunos" },
  { href: "/responsavel/assinatura", label: "Assinatura" },
  { href: "/responsavel/vincular", label: "Usar convite" },
  { href: "/responsavel/buscar", label: "Ver localização" },
  { href: "/responsavel/endereco", label: "Meu endereço" },
];

export async function ResponsavelShell({ children }: { children: ReactNode }) {
  // Mesmo padrão do MotoristaShell: a página já faz o guard de autenticação,
  // aqui só buscamos o nome pra exibir no topo do menu.
  const responsavel = await getAuthenticatedResponsavel();

  return (
    <div className="flex min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
      <AppHeader
        role="responsavel"
        roleLabel="responsável"
        homeHref="/responsavel/dashboard"
        nav={NAV}
        userName={responsavel?.nome}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
