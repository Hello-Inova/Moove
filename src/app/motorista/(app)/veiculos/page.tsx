import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { VeiculosClient } from "@/components/motorista/VeiculosClient";
import { GuideTour, type GuideStep } from "@/components/ui/GuideTour";

const TOUR_STEPS: GuideStep[] = [
  {
    targetId: "tour-veiculos-lista",
    title: "Seu veículo cadastrado",
    text: "Aqui aparece a placa, modelo e documento do seu veículo. Você pode enviar o documento ou excluir o veículo daqui.",
  },
  {
    targetId: "tour-veiculos-form",
    title: "Cadastro é só 1 veículo por vez",
    text: "Cada conta de motorista pode ter só 1 veículo. Pra trocar de van, ônibus ou kombi, exclua o atual antes de cadastrar o novo.",
  },
];

export default async function MotoristaVeiculosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const veiculos = await prisma.veiculo.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Veículos</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Cadastre a placa e os documentos do seu veículo.</p>
        </div>
        <GuideTour steps={TOUR_STEPS} />
      </div>

      <VeiculosClient
        veiculosIniciais={veiculos.map((v) => ({
          id: v.id,
          placa: v.placa,
          modelo: v.modelo,
          temDocumento: Boolean(v.documentoUrl),
        }))}
      />
    </div>
  );
}
