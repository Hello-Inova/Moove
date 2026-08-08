import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/subscription/plans";
import { listarPlanosAtivos } from "@/lib/subscription/planos-service";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusToggleButton } from "@/components/admin/StatusToggleButton";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { ForcarAssinaturaForm } from "@/components/admin/ForcarAssinaturaForm";

const ASSINATURA_STATUS_CLASS: Record<string, string> = {
  TESTE: "bg-blue-100 text-blue-800",
  ATIVA: "bg-green-100 text-green-800",
  EXPIRADA: "bg-neutral-200 text-neutral-600",
  CANCELADA: "bg-neutral-200 text-neutral-600",
};

const PAGAMENTO_STATUS_CLASS: Record<string, string> = {
  PENDENTE: "bg-blue-100 text-blue-800",
  APROVADO: "bg-green-100 text-green-800",
  RECUSADO: "bg-red-100 text-red-700",
  CANCELADO: "bg-neutral-200 text-neutral-600",
};

export default async function AdminMotoristaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { id } = await params;

  const motorista = await prisma.motorista.findUnique({
    where: { id },
    include: {
      assinaturas: {
        orderBy: { criadoEm: "desc" },
        include: { pagamentos: { orderBy: { criadoEm: "desc" } } },
      },
      veiculos: true,
    },
  });

  if (!motorista) notFound();

  const planosAtivos = await listarPlanosAtivos();

  return (
    <AdminShell>
      <div className="space-y-8">
        <div>
          <Link href="/admin/motoristas" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
            ← Motoristas
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{motorista.nome}</h1>
              <p className="text-neutral-500 dark:text-neutral-400">{motorista.email} · {motorista.telefone}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusToggleButton
                url={`/api/admin/motoristas/${motorista.id}/status`}
                statusAtual={motorista.statusConta}
              />
              <AdminDeleteButton
                url={`/api/admin/motoristas/${motorista.id}`}
                confirmMessage={`Excluir a conta de ${motorista.nome}? Isso apaga também veículos, convites, vínculos e assinaturas. Não pode ser desfeito.`}
                redirectTo="/admin/motoristas"
              />
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:bg-neutral-900 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-brand-navy">Forçar ativação de assinatura</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Ativa um plano manualmente, sem passar pelo Mercado Pago — só para suporte/teste.
          </p>
          <div className="mt-4">
            <ForcarAssinaturaForm motoristaId={motorista.id} planos={planosAtivos} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-brand-navy">Assinaturas</h2>
          <div className="mt-3 space-y-3">
            {motorista.assinaturas.length === 0 && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma assinatura ainda.</p>
            )}
            {motorista.assinaturas.map((a) => (
              <div key={a.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:bg-neutral-900 dark:border-neutral-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    Plano {a.planoLabel || a.tipoPlano} · {a.qtdAlunosContratados} aluno(s)
                  </p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ASSINATURA_STATUS_CLASS[a.status]}`}>
                    {a.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Criada em {a.criadoEm.toLocaleDateString("pt-BR")}
                  {a.expiraEm && ` · expira em ${a.expiraEm.toLocaleDateString("pt-BR")}`}
                  {" · "}
                  {formatarBRL(Number(a.valorTotal))}
                </p>

                {a.pagamentos.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                    {a.pagamentos.map((p) => (
                      <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {p.criadoEm.toLocaleDateString("pt-BR")} · {formatarBRL(Number(p.valor))}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAGAMENTO_STATUS_CLASS[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-brand-navy">Veículos</h2>
          <div className="mt-3 space-y-2">
            {motorista.veiculos.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum veículo cadastrado.</p>}
            {motorista.veiculos.map((v) => (
              <div key={v.id} className="rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-sm dark:bg-neutral-900 dark:border-neutral-700">
                {v.placa} · {v.modelo}
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
