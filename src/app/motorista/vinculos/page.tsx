import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { MotoristaShell } from "@/components/motorista/MotoristaShell";
import { RevogarButton } from "@/components/motorista/RevogarButton";

export default async function MotoristaVinculosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
    include: { responsavel: { select: { nome: true, email: true } } },
  });

  const ativos = vinculos.filter((v) => v.status === "ATIVO").length;

  return (
    <MotoristaShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Vínculos</h1>
          <p className="text-neutral-500">
            {ativos} vínculo{ativos === 1 ? "" : "s"} ativo{ativos === 1 ? "" : "s"} — grátis até 5, cobrança a
            partir do 6º.
          </p>
        </div>

        <div className="space-y-3">
          {vinculos.length === 0 && (
            <p className="text-sm text-neutral-500">Nenhum responsável vinculado ainda.</p>
          )}
          {vinculos.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4"
            >
              <div>
                <p className="font-medium">{v.responsavel.nome}</p>
                <p className="text-sm text-neutral-500">{v.responsavel.email}</p>
              </div>
              {v.status === "ATIVO" ? (
                <RevogarButton
                  url={`/api/motorista/vinculos/${v.id}/revogar`}
                  confirmMessage="Revogar este vínculo? O responsável perde acesso imediato à localização."
                />
              ) : (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                  Revogado
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </MotoristaShell>
  );
}
