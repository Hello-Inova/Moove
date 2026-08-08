"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { secondaryButtonClass } from "@/components/ui/form-elements";

export function StatusToggleButton({ url, statusAtual }: { url: string; statusAtual: "ATIVA" | "SUSPENSA" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proximoStatus = statusAtual === "ATIVA" ? "SUSPENSA" : "ATIVA";
  const label = statusAtual === "ATIVA" ? "Suspender" : "Reativar";
  const confirmMessage =
    statusAtual === "ATIVA"
      ? "Suspender esta conta? A pessoa não vai mais conseguir entrar no sistema."
      : "Reativar esta conta?";

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    setError(null);
    const result = await apiPostJson(url, { statusConta: proximoStatus });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={secondaryButtonClass}>
        {loading ? "Aguarde…" : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
