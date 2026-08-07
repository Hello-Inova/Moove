"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api-client";

export function VerDocumentoButton({ veiculoId }: { veiculoId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await apiGet<{ url: string }>(`/api/motorista/veiculos/${veiculoId}/documento`);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className="text-sm font-medium underline">
        {loading ? "Abrindo…" : "Ver documento"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
