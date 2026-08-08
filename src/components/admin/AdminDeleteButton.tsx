"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiDelete } from "@/lib/api-client";
import { dangerButtonClass } from "@/components/ui/form-elements";

export function AdminDeleteButton({
  url,
  confirmMessage,
  redirectTo,
}: {
  url: string;
  confirmMessage: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    setError(null);
    const result = await apiDelete(url);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading} className={dangerButtonClass}>
        {loading ? "Excluindo…" : "Excluir"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
