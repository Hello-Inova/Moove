import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { EscolasClient } from "@/components/motorista/EscolasClient";

export default async function MotoristaEscolasPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

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
          geocodificada: e.enderecoLatitude !== null && e.enderecoLongitude !== null,
        }))}
      />
    </div>
  );
}
