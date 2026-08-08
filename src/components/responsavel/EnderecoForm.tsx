"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPatchJson } from "@/lib/api-client";
import { primaryButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields, type EnderecoValores } from "@/components/ui/EnderecoFields";

export function EnderecoForm({
  defaultValues,
  geocodificado,
}: {
  defaultValues: Partial<EnderecoValores>;
  geocodificado: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});
    setAviso(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      cep: form.get("cep"),
      logradouro: form.get("logradouro"),
      numero: form.get("numero"),
      complemento: form.get("complemento"),
      bairro: form.get("bairro"),
      cidade: form.get("cidade"),
      estado: form.get("estado"),
    };

    const result = await apiPatchJson<{ ok: true; geocodificado: boolean }>("/api/responsavel/endereco", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    if (!result.data.geocodificado) {
      setAviso(
        "Endereço salvo, mas não conseguimos localizá-lo no mapa automaticamente. Confira se está correto — sem isso, esse endereço não entra na rota do motorista."
      );
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {!geocodificado && !aviso && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Ainda não conseguimos localizar este endereço no mapa. Confira os dados e salve novamente.
        </p>
      )}

      <EnderecoFields defaultValues={defaultValues} issues={issues} />

      {aviso && <p className="text-sm text-amber-700 dark:text-amber-400">{aviso}</p>}
      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Salvando…" : "Salvar endereço"}
      </button>
    </form>
  );
}
