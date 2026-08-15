"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";

const STATUS_MSG: Record<string, { text: string; className: string }> = {
  sucesso: {
    text: "Pagamento aprovado! Pode levar alguns segundos para a cobrança sumir da lista abaixo.",
    className: "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  },
  pendente: {
    text: "Pagamento em análise. Assim que for aprovado, a cobrança é baixada automaticamente.",
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  falha: {
    text: "O pagamento não foi concluído. Você pode tentar novamente clicando em \"Pagar agora\".",
    className: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
};

/**
 * Mostra o resultado do checkout Asaas quando o motorista volta pra essa
 * tela (?pagamento=sucesso|pendente|falha, ver backUrlPath em
 * criarCheckoutCobrancaAluno) e, de qualquer forma, revalida direto na Asaas
 * qualquer cobrança por aluno ainda PENDENTE aqui — mesma rede de segurança
 * contra falha de webhook já usada em PlanosClient.tsx.
 */
export function CobrancaAlunoSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusPagamento = searchParams.get("pagamento");

  useEffect(() => {
    let cancelado = false;
    apiPostJson<{ atualizadas: number }>("/api/motorista/cobrancas-aluno/sincronizar", {}).then((result) => {
      if (cancelado || !result.ok) return;
      if (result.data.atualizadas > 0) router.refresh();
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!statusPagamento || !STATUS_MSG[statusPagamento]) return null;

  return (
    <p className={`rounded-lg border px-4 py-3 text-sm ${STATUS_MSG[statusPagamento].className}`}>
      {STATUS_MSG[statusPagamento].text}
    </p>
  );
}
