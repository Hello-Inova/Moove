import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { MotoristaShell } from "@/components/motorista/MotoristaShell";
import { EscolaForm } from "@/components/motorista/EscolaForm";
import { EscolaDeleteButton } from "@/components/motorista/EscolaDeleteButton";

export default async function MotoristaEscolasPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const escolas = await prisma.escola.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <MotoristaShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Minhas escolas</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Cadastre todas as escolas que você atende — o responsável escolhe uma delas ao vincular o filho, e você
            pode traçar rota direto até qualquer uma no painel de rota.
          </p>
        </div>

        <div className="space-y-3">
          {escolas.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma escola cadastrada ainda.</p>
          )}
          {escolas.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700"
            >
              <div>
                <p className="font-medium">{e.nome}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {[e.logradouro, e.numero].filter(Boolean).join(", ")} — {[e.bairro, e.cidade, e.estado].filter(Boolean).join(", ")}
                </p>
                {e.enderecoLatitude === null && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Endereço não localizado no mapa — rota até essa escola não vai funcionar.
                  </p>
                )}
              </div>
              <EscolaDeleteButton id={e.id} nome={e.nome} />
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
          <h2 className="mb-4 font-medium">Cadastrar nova escola</h2>
          <EscolaForm />
        </section>
      </div>
    </MotoristaShell>
  );
}
