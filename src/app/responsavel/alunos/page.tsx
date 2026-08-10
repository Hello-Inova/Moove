import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { AlunosClient } from "@/components/responsavel/AlunosClient";

export default async function ResponsavelAlunosPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Meus alunos</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Cadastre cada filho antes de vincular a um motorista. Depois de assinar um plano, você libera vagas para
            usar códigos de convite — um por aluno.
          </p>
        </div>
        <AlunosClient />
      </div>
    </ResponsavelShell>
  );
}
