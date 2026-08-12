"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPostJson } from "@/lib/api-client";
import { secondaryButtonClass } from "@/components/ui/form-elements";

export function ReativarButton({ url }: { url: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("Reativar este vínculo? Um novo ciclo de 30 dias de cobrança começa a contar agora.")) return;

    setLoading(true);
    setError(null);
    const result = await apiPostJson(url, {});
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={secondaryButtonClass + " w-auto px-3 py-1.5 text-xs"}>
        {loading ? "Reativando…" : "Reativar"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
