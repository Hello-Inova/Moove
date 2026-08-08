"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { primaryButtonClass } from "@/components/ui/form-elements";

export function ForcarAssinaturaForm({ motoristaId }: { motoristaId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <label className="mb-1 block text-xs font-medium text-neutral-600" htmlFor="tipoPlano">
          Plano
        </label>
        <select id="tipoPlano" name="tipoPlano" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="BASIC">Basic</option>
          <option value="PRO">Pró</option>
          <option value="MAX">Max</option>
        </select>
      </div>
      <button type="submit" disabled={loading} className={primaryButtonClass + " w-auto px-4 py-2"}>
        {loading ? "Ativando…" : "Forçar ativação"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
