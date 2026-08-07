"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPostJson } from "@/lib/api-client";
import { primaryButtonClass } from "@/components/ui/form-elements";

export function GerarConviteButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await apiPostJson("/api/motorista/convites", {});
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={primaryButtonClass + " w-auto px-6"}>
        {loading ? "Gerando…" : "Gerar novo convite"}
      </button>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
