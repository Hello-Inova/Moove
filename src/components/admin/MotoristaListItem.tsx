"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

import { StatusToggleButton } from "@/components/admin/StatusToggleButton";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { ForcarAssinaturaForm } from "@/components/admin/ForcarAssinaturaForm";
import { IsentoToggleButton } from "@/components/admin/IsentoToggleButton";
import type { PlanoDefinicao } from "@/lib/subscription/plans";

type Badge = { texto: string; className: string };

/**
 * Card de um motorista na listagem do admin (/admin/motoristas). Todo o
 * texto exibido (badges, datas já formatadas) vem pronto do Server
 * Component pai — esse componente só cuida da interação (expandir/
 * recolher o painel de gerenciamento), sem recalcular nada de data/hora
 * aqui (evita divergência de fuso entre servidor e navegador).
 */
export function MotoristaListItem({
  motoristaId,
  nome,
  email,
  statusConta,
  planoBadge,
  vencimentoBadge,
  alunosCount,
  ultimoAcessoTexto,
  pagamentoTexto,
  isento,
  planos,
}: {
  motoristaId: string;
  nome: string;
  email: string;
  statusConta: "ATIVA" | "SUSPENSA";
  planoBadge: Badge;
  vencimentoBadge: Badge;
  alunosCount: number;
  ultimoAcessoTexto: string;
  pagamentoTexto: string;
  isento: boolean;
  planos: Pick<PlanoDefinicao, "codigo" | "label">[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:bg-neutral-900 dark:border-neutral-700">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/motoristas/${motoristaId}`} className="font-medium text-brand-navy hover:underline">
            {nome}
          </Link>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{email}</p>
        </div>

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Gerenciar
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${planoBadge.className}`}>{planoBadge.texto}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${vencimentoBadge.className}`}>
          {vencimentoBadge.texto}
        </span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {alunosCount} {alunosCount === 1 ? "aluno" : "alunos"}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            statusConta === "ATIVA" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
          }`}
        >
          {statusConta === "ATIVA" ? "Ativa" : "Suspensa"}
        </span>
      </div>

      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        Último acesso: {ultimoAcessoTexto} · {pagamentoTexto}
      </p>

      {aberto && (
        <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <div>
            <p className="mb-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300">Forçar plano (sem passar pela Asaas)</p>
            <ForcarAssinaturaForm motoristaId={motoristaId} planos={planos} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IsentoToggleButton motoristaId={motoristaId} isento={isento} />
            <StatusToggleButton url={`/api/admin/motoristas/${motoristaId}/status`} statusAtual={statusConta} />
            <AdminDeleteButton
              url={`/api/admin/motoristas/${motoristaId}`}
              confirmMessage={`Excluir a conta de ${nome}? Isso apaga também veículos, convites, vínculos e assinaturas. Não pode ser desfeito.`}
            />
            <Link
              href={`/admin/motoristas/${motoristaId}`}
              className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Ver histórico completo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
