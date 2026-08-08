"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { primaryButtonClass } from "@/components/ui/form-elements";
import type { PlanoDefinicao } from "@/lib/subscription/plans";

export function ForcarAssinaturaForm({
  motoristaId,
  planos,
}: {
  motoristaId: string;
  planos: Pick<PlanoDefinicao, "codigo" | "label">[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (planos.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum plano ativo cadastrado ainda.</p>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tipoPlano = form.get("tipoPlano");

    if (
      !window.confirm(
        "Ativar essa assinatura manualmente, sem passar pelo Mercado Pago? Isso cancela qualquer assinatura em aberto do motorista."
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    const result = await apiPostJson(`/api/admin/motoristas/${motoristaId}/assinatura/forcar`, { tipoPlano });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
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
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
