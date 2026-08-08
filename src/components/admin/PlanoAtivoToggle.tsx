"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { secondaryButtonClass } from "@/components/ui/form-elements";

export function PlanoAtivoToggle({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch(`/api/admin/planos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
      });
    } catch {
      setLoading(false);
      setError("Não foi possível conectar ao servidor.");
      return;
    }

    setLoading(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Não foi possível atualizar o plano.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={secondaryButtonClass + " px-3 py-1.5 text-sm"}>
        {loading ? "Aguarde…" : ativo ? "Desativar" : "Ativar"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
