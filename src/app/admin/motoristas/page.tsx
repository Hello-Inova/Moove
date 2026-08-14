import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { contaEmTeste } from "@/lib/subscription/plans";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusToggleButton } from "@/components/admin/StatusToggleButton";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { inputClass } from "@/components/ui/form-elements";

const STATUS_CLASS: Record<string, string> = {
  ATIVA: "bg-green-100 text-green-800",
  SUSPENSA: "bg-red-100 text-red-700",
};

// Mesmas cores usadas no detalhe do motorista (ver [id]/page.tsx) — mantém
// o "de olho" da listagem consistente com a tela de detalhe.
const ASSINATURA_STATUS_CLASS: Record<string, string> = {
  TESTE: "bg-blue-100 text-blue-800",
  ATIVA: "bg-green-100 text-green-800",
  EXPIRADA: "bg-neutral-200 text-neutral-600",
  CANCELADA: "bg-neutral-200 text-neutral-600",
};

/** Rótulo de plano pra listagem — prioriza a assinatura mais recente; sem
 * nenhuma ainda, mas dentro do teste grátis de conta, mostra "Teste". */
function planoBadge(
  assinatura: { planoLabel: string; tipoPlano: string; status: string } | undefined,
  testeExpiraEm: Date
) {
  if (!assinatura) {
    if (contaEmTeste(testeExpiraEm)) {
      return { texto: "Teste (sem plano)", className: ASSINATURA_STATUS_CLASS.TESTE };
    }
    return { texto: "Sem plano", className: "bg-neutral-200 text-neutral-600" };
  }
  return {
    texto: `${assinatura.planoLabel || assinatura.tipoPlano} · ${assinatura.status}`,
    className: ASSINATURA_STATUS_CLASS[assinatura.status] ?? "bg-neutral-200 text-neutral-600",
  };
}

export default async function AdminMotoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { q } = await searchParams;

  const motoristas = await prisma.motorista.findMany({
    where: q
      ? { OR: [{ nome: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : undefined,
    orderBy: { criadoEm: "desc" },
    take: 100,
    // `take: 1` dentro do include traz só a assinatura mais recente de cada
    // motorista (ordenada abaixo) — evita N+1 query pra montar o badge de
    // plano na listagem.
    include: { assinaturas: { orderBy: { criadoEm: "desc" }, take: 1 } },
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Motoristas</h1>
          <p className="text-neutral-500 dark:text-neutral-400">{motoristas.length} encontrado(s).</p>
        </div>

        <form className="max-w-sm">
          <input type="search" name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className={inputClass} />
        </form>

        <div className="space-y-3">
          {motoristas.length === 0 && <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum motorista encontrado.</p>}
          {motoristas.map((m) => {
            const badge = planoBadge(m.assinaturas[0], m.testeExpiraEm);
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:bg-neutral-900 dark:border-neutral-700"
              >
                <div>
                  <Link href={`/admin/motoristas/${m.id}`} className="font-medium text-brand-navy hover:underline">
                    {m.nome}
                  </Link>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{m.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                    {badge.texto}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[m.statusConta]}`}>
                    {m.statusConta === "ATIVA" ? "Ativa" : "Suspensa"}
                  </span>
                  <StatusToggleButton url={`/api/admin/motoristas/${m.id}/status`} statusAtual={m.statusConta} />
                  <AdminDeleteButton
                    url={`/api/admin/motoristas/${m.id}`}
                    confirmMessage={`Excluir a conta de ${m.nome}? Isso apaga também veículos, convites, vínculos e assinaturas. Não pode ser desfeito.`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
