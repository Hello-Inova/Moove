import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { AccessGate } from "@/components/layout/AccessGate";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { contaEmTeste, diasRestantesConta, getAssinaturaResponsavelAtual, responsavelTemAcesso } from "@/lib/subscription/service";

const NAV = [
  { href: "/responsavel/dashboard", label: "Meus vínculos" },
  { href: "/responsavel/alunos", label: "Meus alunos" },
  { href: "/responsavel/assinatura", label: "Assinatura" },
  { href: "/responsavel/vincular", label: "Usar convite" },
  { href: "/responsavel/buscar", label: "Ver localização" },
  { href: "/responsavel/endereco", label: "Meu endereço" },
];

// Mesmo com o teste vencido, precisa dar pra ver/assinar um plano (e sair).
const ALLOWLIST = ["/responsavel/assinatura"];

export async function ResponsavelShell({ children }: { children: ReactNode }) {
  // Mesmo padrão do MotoristaShell: a página já faz o guard de autenticação,
  // aqui só buscamos o nome pra exibir no topo do menu e o status do teste.
  const responsavel = await getAuthenticatedResponsavel();
  const assinatura = responsavel ? await getAssinaturaResponsavelAtual(responsavel.id) : null;
  const assinaturaAtiva = assinatura?.status === "ATIVA";
  const bloqueado = responsavel ? !responsavelTemAcesso(responsavel, assinatura) : false;

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
        {responsavel && (
          <TrialBanner
            emTeste={contaEmTeste(responsavel.testeExpiraEm)}
            diasRestantes={diasRestantesConta(responsavel.testeExpiraEm)}
            assinaturaAtiva={assinaturaAtiva}
            planosHref="/responsavel/assinatura"
          />
        )}
        <AccessGate bloqueado={bloqueado} allowlist={ALLOWLIST} planosHref="/responsavel/assinatura" role="responsavel">
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        </AccessGate>
      </div>
    </div>
  );
}
