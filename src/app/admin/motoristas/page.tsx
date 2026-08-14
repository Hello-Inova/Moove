import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { contaEmTeste, diasRestantesConta } from "@/lib/subscription/plans";
import { listarPlanosAtivos } from "@/lib/subscription/planos-service";
import { AdminShell } from "@/components/admin/AdminShell";
import { MotoristaListItem } from "@/components/admin/MotoristaListItem";
import { inputClass } from "@/components/ui/form-elements";

// Mesmas cores usadas no detalhe do motorista (ver [id]/page.tsx) — mantém
// o "de olho" da listagem consistente com a tela de detalhe.
const ASSINATURA_STATUS_CLASS: Record<string, string> = {
  TESTE: "bg-blue-100 text-blue-800",
  ATIVA: "bg-green-100 text-green-800",
  EXPIRADA: "bg-neutral-200 text-neutral-600",
  CANCELADA: "bg-neutral-200 text-neutral-600",
};

type Badge = { texto: string; className: string };

type AssinaturaResumo = {
  planoLabel: string;
  tipoPlano: string;
  status: string;
  expiraEm: Date | null;
  pagamentos: { status: string; pagoEm: Date | null }[];
};

/** Rótulo de plano pra listagem — prioriza a assinatura mais recente; sem
 * nenhuma ainda, mas dentro do teste grátis de conta, mostra "Teste". */
function planoBadge(assinatura: AssinaturaResumo | undefined, testeExpiraEm: Date): Badge {
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

/** Badge de vencimento — isenção manual sempre vence, depois a assinatura
 * ATIVA (com contagem de dias), depois o teste grátis de conta, senão "sem
 * assinatura ativa". Mesma regra de acesso usada em `motoristaTemAcesso`. */
function vencimentoBadge(motorista: { testeExpiraEm: Date; isentoCobranca: boolean }, assinatura: AssinaturaResumo | undefined): Badge {
  if (motorista.isentoCobranca) {
    return { texto: "Isento de cobrança", className: "bg-purple-100 text-purple-800" };
  }

  if (assinatura?.status === "ATIVA" && assinatura.expiraEm) {
    const dias = Math.ceil((assinatura.expiraEm.getTime() - Date.now()) / 86_400_000);
    const dataTexto = assinatura.expiraEm.toLocaleDateString("pt-BR");
    if (dias < 0) {
      return { texto: `Venceu em ${dataTexto} (há ${Math.abs(dias)}d)`, className: "bg-red-100 text-red-700" };
    }
    if (dias <= 5) {
      return { texto: `Vence em ${dias}d (${dataTexto})`, className: "bg-amber-100 text-amber-800" };
    }
    return { texto: `Vence em ${dias}d (${dataTexto})`, className: "bg-green-100 text-green-800" };
  }

  if (contaEmTeste(motorista.testeExpiraEm)) {
    const dias = diasRestantesConta(motorista.testeExpiraEm);
    return { texto: `Teste grátis · ${dias}d restantes`, className: "bg-blue-100 text-blue-800" };
  }

  return { texto: "Sem assinatura ativa", className: "bg-neutral-200 text-neutral-600" };
}

/** Descreve se a assinatura mais recente foi paga de verdade (via Asaas) ou
 * é cortesia (ativada pelo admin sem gerar nenhum Pagamento) — é isso que
 * responde "foi pago ou não" na listagem. */
function pagamentoTexto(assinatura: AssinaturaResumo | undefined): string {
  if (!assinatura) return "sem histórico de pagamento";

  const pagamento = assinatura.pagamentos[0];
  if (!pagamento) return "cortesia (ativado sem cobrança)";
  if (pagamento.status === "APROVADO") {
    return `pago${pagamento.pagoEm ? ` em ${pagamento.pagoEm.toLocaleDateString("pt-BR")}` : ""}`;
  }
  if (pagamento.status === "PENDENTE") return "pagamento pendente";
  if (pagamento.status === "CANCELADO") return "pagamento cancelado";
  return pagamento.status.toLowerCase();
}

export default async function AdminMotoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const { q } = await searchParams;

  const [motoristas, planosAtivos] = await Promise.all([
    prisma.motorista.findMany({
      where: q
        ? { OR: [{ nome: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : undefined,
      orderBy: { criadoEm: "desc" },
      take: 100,
      include: {
        // `take: 1` traz só a assinatura mais recente de cada motorista
        // (evita N+1 query pra montar os badges de plano/vencimento/pagamento).
        assinaturas: {
          orderBy: { criadoEm: "desc" },
          take: 1,
          include: { pagamentos: { orderBy: { criadoEm: "desc" }, take: 1 } },
        },
        // Só conta vínculos ATIVOS — é a quantidade de alunos que realmente
        // andam com esse motorista hoje (vínculos revogados não contam).
        _count: { select: { vinculos: { where: { status: "ATIVO" } } } },
      },
    }),
    listarPlanosAtivos("MOTORISTA"),
  ]);

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
            const assinatura = m.assinaturas[0];
            return (
              <MotoristaListItem
                key={m.id}
                motoristaId={m.id}
                nome={m.nome}
                email={m.email}
                statusConta={m.statusConta}
                planoBadge={planoBadge(assinatura, m.testeExpiraEm)}
                vencimentoBadge={vencimentoBadge(m, assinatura)}
                alunosCount={m._count.vinculos}
                ultimoAcessoTexto={
                  m.ultimoAcessoEm
                    ? `${m.ultimoAcessoEm.toLocaleDateString("pt-BR")} às ${m.ultimoAcessoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "nunca"
                }
                pagamentoTexto={pagamentoTexto(assinatura)}
                isento={m.isentoCobranca}
                planos={planosAtivos}
              />
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
