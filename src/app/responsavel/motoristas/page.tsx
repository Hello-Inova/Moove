import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { BuscarMotoristasClient } from "@/components/responsavel/BuscarMotoristasClient";

export default async function BuscarMotoristasPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Encontrar motorista</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Pesquise pela escola e endereço para conhecer motoristas cadastrados que atendem o local.</p>
        </div>
        <BuscarMotoristasClient />
      </div>
    </ResponsavelShell>
  );
}
