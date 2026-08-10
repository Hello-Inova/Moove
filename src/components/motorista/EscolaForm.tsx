"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields } from "@/components/ui/EnderecoFields";

export function EscolaForm() {
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
    const payload = {
      nome: form.get("nome"),
      cep: form.get("cep"),
      logradouro: form.get("logradouro"),
      numero: form.get("numero"),
      complemento: form.get("complemento"),
      bairro: form.get("bairro"),
      cidade: form.get("cidade"),
      estado: form.get("estado"),
    };

    const result = await apiPostJson<{ geocodificada: boolean }>("/api/motorista/escolas", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    if (!result.data.geocodificada) {
      setWarning(
        "Escola salva, mas não conseguimos localizá-la no mapa automaticamente. Confira o endereço — sem isso, a rota até essa escola não funciona."
      );
    }

    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="nome">
          Nome da escola
        </label>
        <input id="nome" name="nome" required className={inputClass} />
        <FieldError message={issues.nome?.[0]} />
      </div>

      <EnderecoFields issues={issues} />

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {warning && <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Salvando…" : "Cadastrar escola"}
      </button>
    </form>
  );
}
