"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { apiPostJson } from "@/lib/api-client";

/**
 * Gera o link de pagamento Asaas dessa cobrança e redireciona pra lá — mesmo
 * padrão do botão "Ir para pagamento" do checkout de assinatura
 * (PlanosClient.tsx). Substitui o antigo fluxo manual (cobrar o responsável
 * no WhatsApp + marcar como paga): agora quem paga é o motorista, direto
 * pela plataforma.
 */
export function PagarCobrancaAlunoButton({ cobrancaId }: { cobrancaId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await apiPostJson<{ checkoutUrl: string }>(
      `/api/motorista/cobrancas-aluno/${cobrancaId}/checkout`,
      {}
    );

    if (!result.ok) {
      setLoading(false);
      toast.error(result.error);
      return;
    }

    window.location.href = result.data.checkoutUrl;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70"
    >
      <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Preparando pagamento…" : "Pagar agora"}
    </button>
  );
}
