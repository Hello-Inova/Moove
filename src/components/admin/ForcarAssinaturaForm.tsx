"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiPostJson } from "@/lib/api-client";
import { primaryButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import type { PlanoDefinicao } from "@/lib/subscription/plans";

export function ForcarAssinaturaForm({
  motoristaId,
  planos,
}: {
  motoristaId: string;
  planos: Pick<PlanoDefinicao, "codigo" | "label">[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  if (planos.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum plano ativo cadastrado ainda.</p>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tipoPlano = form.get("tipoPlano");

    const confirmado = await confirm(
      "Ativar essa assinatura manualmente, sem passar pela Asaas? Isso cancela qualquer assinatura em aberto do motorista.",
      { confirmLabel: "Ativar" }
    );
    if (!confirmado) return;

    setLoading(true);
    const result = await apiPostJson(`/api/admin/motoristas/${motoristaId}/assinatura/forcar`, { tipoPlano });
    setLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Assinatura ativada.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300" htmlFor="tipoPlano">
          Plano
        </label>
        <select
          id="tipoPlano"
          name="tipoPlano"
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
        >
          {planos.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={loading} className={primaryButtonClass + " w-auto px-4 py-2"}>
        {loading ? "Ativando…" : "Forçar ativação"}
      </button>
    </form>
  );
}
