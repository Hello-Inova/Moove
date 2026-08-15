"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { apiPostJson } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/ConfirmProvider";

/** Mensalidade do transporte é combinada direto com a família, fora da
 * plataforma — esse botão só registra que o motorista confirmou o
 * recebimento (mesmo espírito do antigo fluxo de CobrancaAluno). */
export function MarcarMensalidadePagaButton({ mensalidadeId }: { mensalidadeId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!(await confirm("Confirmar que recebeu essa mensalidade?", { confirmLabel: "Confirmar" }))) return;

    setLoading(true);
    const result = await apiPostJson(`/api/motorista/mensalidades/${mensalidadeId}/marcar-paga`, {});
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Mensalidade marcada como paga.");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70"
    >
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Confirmando…" : "Marcar como paga"}
    </button>
  );
}
