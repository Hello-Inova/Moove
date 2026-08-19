import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { getAssinaturaAtual, contaEmTeste } from "@/lib/subscription/service";
import { PlanosClient } from "@/components/motorista/PlanosClient";
import { GuideTour, type GuideStep } from "@/components/ui/GuideTour";

const TOUR_STEPS: GuideStep[] = [
  {
    targetId: "tour-planos-cards",
    title: "Escolha um plano",
    text: "Cada card mostra o valor fixo mensal/anual e quantos alunos entram grátis nele. Clique num card pra selecionar.",
  },
  {
    targetId: "tour-planos-resumo",
    title: "Confira o valor antes de pagar",
    text: "Depois de escolher um plano, aparece aqui o resumo do valor total e o botão pra ir pro pagamento. Lembre-se: a cobrança por aluno excedente é separada e fica na aba \"Alunos\".",
  },
];

export default async function MotoristaPlanosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const assinatura = await getAssinaturaAtual(motorista.id);
  const tipoPlanoAtual: string | null = assinatura?.status === "ATIVA" ? assinatura.tipoPlano : null;

  const assinaturaInfo = contaEmTeste(motorista.testeExpiraEm)
    ? { situacao: "TESTE" as const, planoLabel: null, expiraEm: motorista.testeExpiraEm }
    : assinatura?.status === "ATIVA"
      ? { situacao: "ATIVA" as const, planoLabel: assinatura.planoLabel, expiraEm: assinatura.expiraEm }
      : { situacao: "EXPIRADA" as const, planoLabel: assinatura?.planoLabel ?? null, expiraEm: null };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Planos</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Escolha um plano e finalize o pagamento com segurança — valor fixo, independente da quantidade de
            alunos.
          </p>
        </div>
        <GuideTour steps={TOUR_STEPS} />
      </div>

      <Suspense fallback={null}>
        <PlanosClient tipoPlanoAtual={tipoPlanoAtual} assinaturaInfo={assinaturaInfo} />
      </Suspense>
    </div>
  );
}
