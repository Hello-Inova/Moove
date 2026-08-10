"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { apiPostForm } from "@/lib/api-client";

export function UploadDocumentoButton({ veiculoId, onUploaded }: { veiculoId: string; onUploaded?: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.set("documento", file);
    const result = await apiPostForm(`/api/motorista/veiculos/${veiculoId}/documento`, form);
    setLoading(false);
    event.target.value = "";

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onUploaded?.();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="text-sm font-medium text-neutral-700 underline dark:text-neutral-300"
      >
        {loading ? "Enviando…" : "Enviar documento"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
