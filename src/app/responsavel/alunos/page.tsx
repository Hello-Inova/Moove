import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { AlunosClient } from "@/components/responsavel/AlunosClient";

export default async function ResponsavelAlunosPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  const { novo } = await searchParams;

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Meus alunos</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Cadastre cada filho, com o endereço de embarque/desembarque dele, antes de vincular a um motorista. Cada
            aluno pode ter um endereço diferente. Depois de assinar um plano, você libera vagas para usar códigos de
            convite — um por aluno.
          </p>
        </div>

        {novo === "1" && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            Sua conta foi criada! Cadastre abaixo o(s) aluno(s), com o endereço de cada um — é assim que o motorista
            encontra vocês.
          </div>
        )}

        <AlunosClient />
      </div>
    </ResponsavelShell>
  );
}
