"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { apiPostJson } from "@/lib/api-client";

/**
 * Gera o link de pagamento Asaas cobrindo TODAS as cobranças por aluno
 * pendentes do motorista de uma vez (ver criarCheckoutCobrancasAlunoPendentes
 * — a Asaas exige valor mínimo de R$5,00 por cobrança, então cobranças
 * individuais menores que isso são agrupadas) e redireciona pra lá. Mesmo
 * padrão do botão "Ir para pagamento" do checkout de assinatura
 * (PlanosClient.tsx).
 */
export function PagarCobrancasPendentesButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await apiPostJson<{ checkoutUrl: string }>("/api/motorista/cobrancas-aluno/checkout", {});

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
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70"
    >
      <CreditCard className="h-4 w-4" aria-hidden="true" />
      {loading ? "Preparando pagamento…" : "Pagar tudo agora"}
    </button>
  );
}
