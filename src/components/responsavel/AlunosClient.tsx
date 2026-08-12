"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiGet, apiPostJson, apiDelete } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";

type Aluno = {
  id: string;
  nome: string;
  vinculado: boolean;
  motoristaNome: string | null;
  escolaNome: string | null;
};

export function AlunosClient() {
  const [alunos, setAlunos] = useState<Aluno[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    const alunosResult = await apiGet<Aluno[]>("/api/responsavel/alunos");

    if (!alunosResult.ok) {
      setLoadError(alunosResult.error);
      return;
    }
    setAlunos(alunosResult.data);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const result = await apiPostJson<Aluno>("/api/responsavel/alunos", { nome: form.get("nome") });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    event.currentTarget.reset();
    void carregar();
  }

  async function handleDelete(id: string, nome: string) {
    if (!window.confirm(`Remover "${nome}" da sua lista de alunos?`)) return;
    const result = await apiDelete(`/api/responsavel/alunos/${id}`);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    void carregar();
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-3 font-medium">Meus alunos</h2>

        {!alunos && <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando…</p>}
        {alunos && alunos.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum aluno cadastrado ainda.</p>
        )}

        <ul className="space-y-2">
          {alunos?.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-700"
            >
              <div>
                <p className="font-medium">{a.nome}</p>
                {a.vinculado ? (
                  <p className="text-neutral-500 dark:text-neutral-400">
                    Vinculado a {a.motoristaNome}
                    {a.escolaNome ? ` · ${a.escolaNome}` : ""}
                  </p>
                ) : (
                  <p className="text-neutral-500 dark:text-neutral-400">Ainda não vinculado a um motorista</p>
                )}
              </div>
              {!a.vinculado && (
                <button onClick={() => handleDelete(a.id, a.nome)} className={dangerButtonClass + " w-auto px-3 py-1.5 text-xs"}>
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3" noValidate>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium" htmlFor="nome">
              Nome do aluno
            </label>
            <input id="nome" name="nome" required className={inputClass} />
            <FieldError message={issues.nome?.[0]} />
          </div>
          <button type="submit" disabled={loading} className={primaryButtonClass + " w-auto px-4"}>
            {loading ? "Adicionando…" : "Adicionar aluno"}
          </button>
        </form>
        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
      </section>
    </div>
  );
}
