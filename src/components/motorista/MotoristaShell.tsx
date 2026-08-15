import type { ReactNode } from "react";
import { MapPin, School, Truck, Send, Users, FileBarChart, CreditCard, Sparkles } from "lucide-react";

import { AppHeader, type NavItem } from "@/components/layout/AppHeader";
import { AccessGate } from "@/components/layout/AccessGate";
import { TrialBanner } from "@/components/layout/TrialBanner";
import { LocationSharingProvider } from "@/contexts/LocationSharingContext";
import { MapaExpandidoProvider } from "@/contexts/MapaExpandidoContext";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { contaEmTeste, diasRestantesConta, getAssinaturaAtual, motoristaTemAcesso } from "@/lib/subscription/service";

const ICON_CLASS = "h-4 w-4 shrink-0";

const NAV: NavItem[] = [
  { href: "/motorista/dashboard", label: "Rota", icon: <MapPin className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/motorista/escolas", label: "Escolas", icon: <School className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/motorista/veiculos", label: "Veículo", icon: <Truck className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/motorista/convites", label: "Convites", icon: <Send className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/motorista/vinculos", label: "Alunos", icon: <Users className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/motorista/relatorios", label: "Relatórios", icon: <FileBarChart className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/motorista/cobrancas", label: "Cobranças", icon: <CreditCard className={ICON_CLASS} aria-hidden="true" /> },
  { href: "/motorista/planos", label: "Planos", icon: <Sparkles className={ICON_CLASS} aria-hidden="true" /> },
];

// Rotas liberadas mesmo com o teste vencido — precisa dar pra ver/assinar um
// plano (e sair) mesmo bloqueado, senão a pessoa fica sem saída nenhuma.
const ALLOWLIST = ["/motorista/planos", "/motorista/cobrancas"];

export async function MotoristaShell({ children }: { children: ReactNode }) {
  // A página que renderiza o shell já faz o próprio guard de autenticação;
  // aqui só precisamos do status da assinatura para o alerta do topo, então
  // seguimos sem redirecionar caso não haja sessão (não deveria acontecer).
  const motorista = await getAuthenticatedMotorista();
  const assinatura = motorista ? await getAssinaturaAtual(motorista.id) : null;
  const assinaturaAtiva = assinatura?.status === "ATIVA";
  const bloqueado = motorista ? !motoristaTemAcesso(motorista, assinatura) : false;

  return (
    <LocationSharingProvider>
      <MapaExpandidoProvider>
        <div className="flex min-h-full flex-1 flex-col bg-neutral-50 dark:bg-neutral-950 md:flex-row">
          <AppHeader role="motorista" roleLabel="motorista" homeHref="/motorista/dashboard" nav={NAV} userName={motorista?.nome} />
          <div className="flex min-w-0 flex-1 flex-col">
            {motorista && (
              <TrialBanner
                emTeste={contaEmTeste(motorista.testeExpiraEm)}
                diasRestantes={diasRestantesConta(motorista.testeExpiraEm)}
                assinaturaAtiva={assinaturaAtiva}
                planosHref="/motorista/planos"
              />
            )}
            <AccessGate bloqueado={bloqueado} allowlist={ALLOWLIST} planosHref="/motorista/planos" role="motorista">
              <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
            </AccessGate>
          </div>
        </div>
      </MapaExpandidoProvider>
    </LocationSharingProvider>
  );
}
