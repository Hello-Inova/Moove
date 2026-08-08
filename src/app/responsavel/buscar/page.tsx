import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { BuscarPlacaClient } from "@/components/responsavel/BuscarPlacaClient";

export default async function ResponsavelBuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ placa?: string | string[] }>;
}) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  const params = await searchParams;
  const placaParam = params.placa;
  const placaInicial = Array.isArray(placaParam) ? placaParam[0] : placaParam;

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Ver localização</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Escolha o motorista na lista — só aparecem aqui os motoristas com quem você tem um vínculo ativo.
          </p>
        </div>
        <BuscarPlacaClient placaInicial={placaInicial} />
      </div>
    </ResponsavelShell>
  );
}
