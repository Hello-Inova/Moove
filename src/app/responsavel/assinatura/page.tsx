import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { AssinaturaResponsavelClient } from "@/components/responsavel/AssinaturaResponsavelClient";

export default async function ResponsavelAssinaturaPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Assinatura</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Escolha um plano — o valor é o preço por aluno multiplicado pela quantidade de alunos cadastrados.
          </p>
        </div>
        <Suspense fallback={null}>
          <AssinaturaResponsavelClient />
        </Suspense>
      </div>
    </ResponsavelShell>
  );
}
