import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { MotoristaShell } from "@/components/motorista/MotoristaShell";

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
};

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: "bg-blue-100 text-blue-800",
  PAGO: "bg-green-100 text-green-800",
  ATRASADO: "bg-red-100 text-red-700",
};

function formatBRL(value: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

export default async function MotoristaCobrancasPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const [plano, cobrancas] = await Promise.all([
    prisma.plano.findUnique({ where: { motoristaId: motorista.id } }),
    prisma.cobranca.findMany({
      where: { motoristaId: motorista.id },
      orderBy: { referenciaMes: "desc" },
    }),
  ]);

  return (
    <MotoristaShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Cobranças</h1>
          <p className="text-neutral-500">
            Grátis até {plano?.alunosIncluidosGratis ?? 5} alunos vinculados. A partir do próximo,{" "}
            {plano ? formatBRL(plano.valorPorAlunoExcedente.toString()) : "R$ 5–7"} por aluno/mês.
          </p>
        </div>

        <div className="space-y-3">
          {cobrancas.length === 0 && (
            <p className="text-sm text-neutral-500">
              Nenhuma cobrança gerada ainda. O fechamento roda mensalmente com base nos vínculos ativos.
            </p>
          )}
          {cobrancas.map((c) => (
            <div key={c.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{c.referenciaMes}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.status]}`}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                {c.qtdAlunosVinculados} alunos vinculados · {c.qtdAlunosCobrados} cobrados
              </p>
              <p className="mt-1 font-semibold">{formatBRL(c.valorTotal.toString())}</p>
            </div>
          ))}
        </div>
      </div>
    </MotoristaShell>
  );
}
