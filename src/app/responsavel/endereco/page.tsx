import { redirect } from "next/navigation";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { EnderecoForm } from "@/components/responsavel/EnderecoForm";

export default async function ResponsavelEnderecoPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  const { novo } = await searchParams;
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

        {novo === "1" && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
            Sua conta foi criada! Confira o endereço abaixo e confirme o pino no mapa antes de continuar — é assim
            que o motorista encontra você.
          </div>
        )}

        <section className="max-w-md rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
          <EnderecoForm
            geocodificado={geocodificado}
            enderecoLatitude={responsavel.enderecoLatitude}
            enderecoLongitude={responsavel.enderecoLongitude}
            enderecoTextoEncontrado={responsavel.enderecoTextoEncontrado}
            enderecoConfirmado={responsavel.enderecoConfirmado}
            enderecoPrecisaoBaixa={responsavel.enderecoPrecisaoBaixa}
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
