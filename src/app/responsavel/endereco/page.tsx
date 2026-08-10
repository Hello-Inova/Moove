import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { EnderecoForm } from "@/components/responsavel/EnderecoForm";

export default async function ResponsavelEnderecoPage() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  const geocodificado = responsavel.enderecoLatitude !== null && responsavel.enderecoLongitude !== null;

  return (
    <ResponsavelShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Meu endereço</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Endereço de embarque/desembarque do(s) aluno(s) — é a partir dele que o motorista traça a rota até
            você. Mantenha atualizado se mudar de endereço.
          </p>
        </div>

        <section className="max-w-md rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
          <EnderecoForm
            geocodificado={geocodificado}
            enderecoLatitude={responsavel.enderecoLatitude}
            enderecoLongitude={responsavel.enderecoLongitude}
            defaultValues={{
              cep: responsavel.cep ?? "",
              logradouro: responsavel.logradouro ?? "",
              numero: responsavel.numero ?? "",
              complemento: responsavel.complemento ?? "",
              bairro: responsavel.bairro ?? "",
              cidade: responsavel.cidade ?? "",
              estado: responsavel.estado ?? "",
            }}
          />
        </section>
      </div>
    </ResponsavelShell>
  );
}
