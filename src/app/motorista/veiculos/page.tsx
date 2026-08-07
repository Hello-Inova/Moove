import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { MotoristaShell } from "@/components/motorista/MotoristaShell";
import { VeiculoForm } from "@/components/motorista/VeiculoForm";
import { VerDocumentoButton } from "@/components/motorista/VerDocumentoButton";
import { UploadDocumentoButton } from "@/components/motorista/UploadDocumentoButton";

export default async function MotoristaVeiculosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const veiculos = await prisma.veiculo.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <MotoristaShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Veículos</h1>
          <p className="text-neutral-500">Cadastre a placa e os documentos do seu veículo.</p>
        </div>

        <div className="space-y-3">
          {veiculos.length === 0 && (
            <p className="text-sm text-neutral-500">Nenhum veículo cadastrado ainda.</p>
          )}
          {veiculos.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
            >
              <div>
                <p className="font-medium">{v.placa}</p>
                <p className="text-sm text-neutral-500">{v.modelo}</p>
              </div>
              <div className="flex items-center gap-4">
                {v.documentoUrl ? (
                  <VerDocumentoButton veiculoId={v.id} />
                ) : (
                  <span className="text-sm text-neutral-400">Sem documento</span>
                )}
                <UploadDocumentoButton veiculoId={v.id} />
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 font-medium">Cadastrar novo veículo</h2>
          <VeiculoForm />
        </section>
      </div>
    </MotoristaShell>
  );
}
