"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { apiPostJson } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/ConfirmProvider";

/** Reverso do MarcarMensalidadePagaButton — desfaz o "paga" e volta a
 * mensalidade pra pendente/atrasada (não existe status "atrasado" separado
 * no banco: uma mensalidade pendente já vencida aparece como atrasada em
 * qualquer lugar que calcule isso, ver Painel). Existe pra corrigir um
 * clique errado em "Marcar como paga" ou reabrir uma cobrança que a família
 * ainda não acertou de verdade. */
export function MarcarMensalidadePendenteButton({ mensalidadeId }: { mensalidadeId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (
      !(await confirm(
        "Desfazer o pagamento dessa mensalidade? Ela volta a aparecer como pendente/atrasada.",
        { confirmLabel: "Desfazer" }
      ))
    ) {
      return;
    }

    setLoading(true);
    const result = await apiPostJson(`/api/motorista/mensalidades/${mensalidadeId}/marcar-pendente`, {});
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Mensalidade marcada como não paga.");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Desfazendo…" : "Desfazer pagamento"}
    </button>
  );
}
