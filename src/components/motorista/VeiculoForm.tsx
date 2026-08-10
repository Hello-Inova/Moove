"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostForm } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass } from "@/components/ui/form-elements";

export function VeiculoForm({ onSaved }: { onSaved?: () => void } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setWarning(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const result = await apiPostForm<{ avisoDocumento?: string }>("/api/motorista/veiculos", form);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    if (result.data.avisoDocumento) {
      setWarning(`Veículo cadastrado. ${result.data.avisoDocumento}`);
    }

    event.currentTarget.reset();
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="placa">
          Placa
        </label>
        <input
          id="placa"
          name="placa"
          required
          placeholder="ABC1D23"
          className={inputClass + " uppercase"}
        />
        <FieldError message={issues.placa?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="modelo">
          Modelo do veículo
        </label>
        <input id="modelo" name="modelo" required placeholder="Fiat Ducato" className={inputClass} />
        <FieldError message={issues.modelo?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="documento">
          Documento do veículo (opcional agora, pode enviar depois)
        </label>
        <input
          id="documento"
          name="documento"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className={inputClass + " cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5"}
        />
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          O documento é apenas armazenado para consulta — não há etapa de aprovação manual.
        </p>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {warning && <p className="text-sm text-amber-700">{warning}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Salvando…" : "Cadastrar veículo"}
      </button>
    </form>
  );
}
