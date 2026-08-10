import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/AppHeader";
import { LocationSharingProvider } from "@/contexts/LocationSharingContext";
import { TrialBanner } from "@/components/motorista/TrialBanner";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { diasRestantesTeste, getAssinaturaAtual } from "@/lib/subscription/service";

const NAV = [
  { href: "/motorista/dashboard", label: "Rota" },
  { href: "/motorista/escolas", label: "Escolas" },
  { href: "/motorista/veiculos", label: "Veículo" },
  { href: "/motorista/convites", label: "Convites" },
  { href: "/motorista/vinculos", label: "Vínculos" },
  { href: "/motorista/cobrancas", label: "Cobranças" },
  { href: "/motorista/planos", label: "Planos" },
];

export async function MotoristaShell({ children }: { children: ReactNode }) {
  // A página que renderiza o shell já faz o próprio guard de autenticação;
  // aqui só precisamos do status da assinatura para o alerta do topo, então
  // seguimos sem redirecionar caso não haja sessão (não deveria acontecer).
  const motorista = await getAuthenticatedMotorista();
  const assinatura = motorista ? await getAssinaturaAtual(motorista.id) : null;

  return (
    <LocationSharingProvider>
      <div className="flex min-h-full flex-1 bg-neutral-50 dark:bg-neutral-950">
        <AppHeader role="motorista" roleLabel="motorista" homeHref="/motorista/dashboard" nav={NAV} userName={motorista?.nome} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TrialBanner status={assinatura?.status ?? "SEM_ASSINATURA"} diasRestantes={diasRestantesTeste(assinatura)} />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
        </div>
      </div>
    </LocationSharingProvider>
  );
}
