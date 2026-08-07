"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPostJson } from "@/lib/api-client";
import { dangerButtonClass } from "@/components/ui/form-elements";

export function RevogarButton({ url, confirmMessage }: { url: string; confirmMessage: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;

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
      <button onClick={handleClick} disabled={loading} className={dangerButtonClass}>
        {loading ? "Revogando…" : "Revogar"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
