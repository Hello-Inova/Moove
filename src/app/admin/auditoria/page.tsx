import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/AdminShell";

const LABEL_ACAO: Record<string, string> = {
  LOGIN_ADMIN: "Login no painel",
  SUSPENDER_CONTA: "Conta suspensa",
  REATIVAR_CONTA: "Conta reativada",
  EXCLUIR_MOTORISTA: "Motorista excluído",
  EXCLUIR_RESPONSAVEL: "Responsável excluído",
  FORCAR_ASSINATURA: "Assinatura forçada",
  CRIAR_PLANO: "Plano criado",
  ATUALIZAR_PLANO: "Plano atualizado",
  ATIVAR_PLANO: "Plano ativado",
  DESATIVAR_PLANO: "Plano desativado",
  EXCLUIR_PLANO: "Plano excluído",
};

const COR_ACAO: Record<string, string> = {
  LOGIN_ADMIN: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  SUSPENDER_CONTA: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
  REATIVAR_CONTA: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400",
  EXCLUIR_MOTORISTA: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  EXCLUIR_RESPONSAVEL: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  FORCAR_ASSINATURA: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400",
  CRIAR_PLANO: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400",
  ATUALIZAR_PLANO: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400",
  ATIVAR_PLANO: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400",
  DESATIVAR_PLANO: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400",
  EXCLUIR_PLANO: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
};

function linkEntidade(entidade: string, entidadeId: string | null): string | null {
  if (!entidadeId) return null;
  if (entidade === "Motorista") return `/admin/motoristas/${entidadeId}`;
  if (entidade === "Plano") return `/admin/planos/${entidadeId}`;
  return null;
}

function resumoDetalhes(detalhes: unknown): string | null {
  if (!detalhes || typeof detalhes !== "object") return null;
  const partes = Object.entries(detalhes as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return partes.length > 0 ? partes.join(" · ") : null;
}

export default async function AdminAuditoriaPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");

  const logs = await prisma.logAuditoria.findMany({
    orderBy: { criadoEm: "desc" },
    take: 200,
  });

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Log de auditoria</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Últimas {logs.length} ações sensíveis feitas neste painel — suspender/reativar conta, excluir
            motorista ou responsável, forçar assinatura, e alterações em planos. Guardado indefinidamente.
          </p>
        </div>

        {logs.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma ação registrada ainda.</p>
        )}

        <div className="space-y-2">
          {logs.map((log) => {
            const href = linkEntidade(log.entidade, log.entidadeId);
            const detalhesTexto = resumoDetalhes(log.detalhes);

            return (
              <div
                key={log.id}
                className="flex flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_ACAO[log.acao] ?? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"}`}
                    >
                      {LABEL_ACAO[log.acao] ?? log.acao}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">{log.entidade}</span>
                    {href && (
                      <Link href={href} className="text-xs text-brand-orange-dark underline underline-offset-2">
                        ver registro
                      </Link>
                    )}
                  </div>
                  {detalhesTexto && (
                    <p className="break-words text-sm text-neutral-600 dark:text-neutral-300">{detalhesTexto}</p>
                  )}
                </div>
                <div className="shrink-0 text-left text-xs text-neutral-400 dark:text-neutral-500 sm:text-right">
                  <div>{log.criadoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div>
                  {log.ip && <div>IP: {log.ip}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
