import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { getAssinaturaAtual } from "@/lib/subscription/service";
import { MotoristaShell } from "@/components/motorista/MotoristaShell";
import { PlanosClient } from "@/components/motorista/PlanosClient";

export default async function MotoristaPlanosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const assinatura = await getAssinaturaAtual(motorista.id);
  const tipoPlanoAtual = assinatura?.status === "ATIVA" ? assinatura.tipoPlano : null;

  return (
    <MotoristaShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Planos</h1>
          <p className="text-neutral-500">
            Escolha um plano, informe a quantidade de alunos e finalize o pagamento com segurança.
          </p>
        </div>

        <Suspense fallback={null}>
          <PlanosClient tipoPlanoAtual={tipoPlanoAtual} />
        </Suspense>
      </div>
    </MotoristaShell>
  );
}
