"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPatchJson, apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { EnderecoFields, type EnderecoValores } from "@/components/ui/EnderecoFields";

export type EscolaEditavel = {
  id: string;
  nome: string;
} & Partial<EnderecoValores>;

/**
 * Formulário de escola — serve tanto pra cadastrar (sem `escola`) quanto
 * editar (`escola` com os valores atuais pré-preenchidos). Em modo edição,
 * `onCancel` fecha o formulário sem salvar.
 */
export function EscolaForm({ escola, onSaved, onCancel }: { escola?: EscolaEditavel; onSaved?: () => void; onCancel?: () => void }) {
  const router = useRouter();
  const editando = Boolean(escola);
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

    const result = editando
      ? await apiPatchJson<{ geocodificada: boolean }>(`/api/motorista/escolas/${escola!.id}`, payload)
      : await apiPostJson<{ geocodificada: boolean }>("/api/motorista/escolas", payload);
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

    if (!editando) event.currentTarget.reset();
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="nome">
          Nome da escola
        </label>
        <input id="nome" name="nome" required defaultValue={escola?.nome} className={inputClass} />
        <FieldError message={issues.nome?.[0]} />
      </div>

      <EnderecoFields
        issues={issues}
        defaultValues={
          escola
            ? {
                cep: escola.cep ?? "",
                logradouro: escola.logradouro ?? "",
                numero: escola.numero ?? "",
                complemento: escola.complemento ?? "",
                bairro: escola.bairro ?? "",
                cidade: escola.cidade ?? "",
                estado: escola.estado ?? "",
              }
            : undefined
        }
      />

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {warning && <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Salvando…" : editando ? "Salvar alterações" : "Cadastrar escola"}
        </button>
        {editando && (
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
