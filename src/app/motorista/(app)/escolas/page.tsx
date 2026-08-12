import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { EscolasClient } from "@/components/motorista/EscolasClient";

export default async function MotoristaEscolasPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const { novo } = await searchParams;

  const escolas = await prisma.escola.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Minhas escolas</h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Cadastre todas as escolas que você atende — o responsável escolhe uma delas ao vincular o filho, e você
          pode traçar rota direto até qualquer uma no painel de rota.
        </p>
      </div>

      {novo === "1" && (
        <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          Sua conta foi criada! Clique em &quot;Editar&quot; na escola abaixo e confirme o pino no mapa antes de
          continuar — é isso que garante que a rota até ela saia certa.
        </div>
      )}

      <EscolasClient
        escolasIniciais={escolas.map((e) => ({
          id: e.id,
          nome: e.nome,
          cep: e.cep,
          logradouro: e.logradouro,
          numero: e.numero,
          complemento: e.complemento,
          bairro: e.bairro,
          cidade: e.cidade,
          estado: e.estado,
          enderecoLatitude: e.enderecoLatitude,
          enderecoLongitude: e.enderecoLongitude,
          enderecoTextoEncontrado: e.enderecoTextoEncontrado,
          enderecoConfirmado: e.enderecoConfirmado,
          enderecoPrecisaoBaixa: e.enderecoPrecisaoBaixa,
          geocodificada: e.enderecoLatitude !== null && e.enderecoLongitude !== null,
        }))}
      />
    </div>
  );
}
