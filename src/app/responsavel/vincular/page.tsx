import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { UsarConviteForm } from "@/components/responsavel/UsarConviteForm";

export default async function ResponsavelVincularPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Usar convite</h1>
          <p className="text-neutral-500">
            Insira o código recebido do motorista para criar o vínculo e acompanhar a localização dele.
          </p>
        </div>
        <section className="max-w-sm rounded-xl border border-neutral-200 bg-white p-5">
          <UsarConviteForm />
        </section>
      </div>
    </ResponsavelShell>
  );
}
