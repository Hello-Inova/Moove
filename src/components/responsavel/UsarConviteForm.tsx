"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";

export function UsarConviteForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const result = await apiPostJson<{ motoristaNome: string }>("/api/responsavel/convites/usar", {
      codigo: form.get("codigo"),
    });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setSuccess(`Vínculo criado com ${result.data.motoristaNome}!`);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="codigo">
          Código do convite
        </label>
        <input
          id="codigo"
          name="codigo"
          required
          placeholder="ABCD1234"
          className={inputClass + " uppercase tracking-widest"}
        />
        <p className="mt-1 text-xs text-neutral-500">Código recebido do motorista, válido por 7 dias.</p>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Vinculando…" : "Usar convite"}
      </button>
    </form>
  );
}
