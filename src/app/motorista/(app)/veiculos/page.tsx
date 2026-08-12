import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { VeiculosClient } from "@/components/motorista/VeiculosClient";

export default async function MotoristaVeiculosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const veiculos = await prisma.veiculo.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Veículos</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Cadastre a placa e os documentos do seu veículo.</p>
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
