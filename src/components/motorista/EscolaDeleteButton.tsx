"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiDelete } from "@/lib/api-client";
import { dangerButtonClass } from "@/components/ui/form-elements";

export function EscolaDeleteButton({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Excluir a escola "${nome}"?`)) return;
    setLoading(true);
    setError(null);
    const result = await apiDelete(`/api/motorista/escolas/${id}`);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleDelete} disabled={loading} className={dangerButtonClass + " w-auto px-3 py-1.5 text-xs"}>
        {loading ? "Excluindo…" : "Excluir"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
