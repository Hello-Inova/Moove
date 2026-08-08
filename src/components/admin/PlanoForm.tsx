"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { apiPostJson, apiDelete } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, dangerButtonClass } from "@/components/ui/form-elements";
import type { PlanoDefinicao } from "@/lib/subscription/plans";

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues?: Record<string, string[] | undefined> };

async function apiPut<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, error: "Não foi possível conectar ao servidor." };
  }
  const body2 = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, error: body2?.error ?? "Ocorreu um erro inesperado.", issues: body2?.issues };
  }
  return { ok: true, data: body2 as T };
}

const CICLOS = [
  { value: "MENSAL", label: "Mensal" },
  { value: "SEMESTRAL", label: "Semestral" },
  { value: "ANUAL", label: "Anual" },
] as const;

export function PlanoForm({ planoExistente }: { planoExistente?: PlanoDefinicao }) {
  const router = useRouter();
  const editando = Boolean(planoExistente);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [permiteAnosAdicionais, setPermiteAnosAdicionais] = useState(planoExistente?.permiteAnosAdicionais ?? false);
  const [ativo, setAtivo] = useState(planoExistente?.ativo ?? true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const recursosRaw = String(form.get("recursos") ?? "");
    const recursos = recursosRaw
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);

    const payload = {
      codigo: String(form.get("codigo") ?? ""),
      label: String(form.get("label") ?? ""),
      ciclo: String(form.get("ciclo") ?? "MENSAL"),
      cicloLabel: String(form.get("cicloLabel") ?? ""),
      valorBase: Number(form.get("valorBase")),
      alunosGratis: Number(form.get("alunosGratis") || 0),
      valorPorAlunoExcedente: Number(form.get("valorPorAlunoExcedente") || 0),
      recursos,
      permiteAnosAdicionais,
      destaque: String(form.get("destaque") ?? "").trim() || null,
      ativo,
      ordem: Number(form.get("ordem") || 0),
    };

    const result = editando
      ? await apiPut(`/api/admin/planos/${planoExistente!.id}`, payload)
      : await apiPostJson("/api/admin/planos", payload);

    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    router.push("/admin/planos");
    router.refresh();
  }

  async function handleDelete() {
    if (!planoExistente) return;
    if (!window.confirm(`Excluir definitivamente o plano "${planoExistente.label}"?`)) return;

    setDeleting(true);
    setFormError(null);
    const result = await apiDelete(`/api/admin/planos/${planoExistente.id}`);
    setDeleting(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    router.push("/admin/planos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="codigo">
            Código (identificador único)
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            defaultValue={planoExistente?.codigo}
            placeholder="BASIC"
            className={inputClass + " uppercase"}
          />
          <FieldError message={issues.codigo?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="label">
            Nome exibido
          </label>
          <input id="label" name="label" required defaultValue={planoExistente?.label} placeholder="Basic" className={inputClass} />
          <FieldError message={issues.label?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ciclo">
            Ciclo de cobrança
          </label>
          <select
            id="ciclo"
            name="ciclo"
            defaultValue={planoExistente?.ciclo ?? "MENSAL"}
            className={inputClass}
          >
            {CICLOS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <FieldError message={issues.ciclo?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="cicloLabel">
            Rótulo do ciclo (texto exibido)
          </label>
          <input
            id="cicloLabel"
            name="cicloLabel"
            required
            defaultValue={planoExistente?.cicloLabel}
            placeholder="Cobrança mensal"
            className={inputClass}
          />
          <FieldError message={issues.cicloLabel?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="valorBase">
            Valor base (R$)
          </label>
          <input
            id="valorBase"
            name="valorBase"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={planoExistente?.valorBase}
            className={inputClass}
          />
          <FieldError message={issues.valorBase?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="alunosGratis">
            Alunos grátis incluídos
          </label>
          <input
            id="alunosGratis"
            name="alunosGratis"
            type="number"
            min="0"
            defaultValue={planoExistente?.alunosGratis ?? 0}
            className={inputClass}
          />
          <FieldError message={issues.alunosGratis?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="valorPorAlunoExcedente">
            Valor por aluno excedente (R$)
          </label>
          <input
            id="valorPorAlunoExcedente"
            name="valorPorAlunoExcedente"
            type="number"
            step="0.01"
            min="0"
            defaultValue={planoExistente?.valorPorAlunoExcedente ?? 1}
            className={inputClass}
          />
          <FieldError message={issues.valorPorAlunoExcedente?.[0]} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="destaque">
            Selo de destaque (opcional)
          </label>
          <input
            id="destaque"
            name="destaque"
            defaultValue={planoExistente?.destaque ?? ""}
            placeholder="Mais popular"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="ordem">
            Ordem de exibição
          </label>
          <input id="ordem" name="ordem" type="number" min="0" defaultValue={planoExistente?.ordem ?? 0} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="recursos">
          Recursos (um por linha)
        </label>
        <textarea
          id="recursos"
          name="recursos"
          rows={5}
          defaultValue={planoExistente?.recursos.join("\n")}
          placeholder={"Cobrança mensal\n7 dias de teste\n+ R$ 1,00 por aluno"}
          className={inputClass}
        />
        <FieldError message={issues.recursos?.[0]} />
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={permiteAnosAdicionais}
            onChange={(e) => setPermiteAnosAdicionais(e.target.checked)}
          />
          Permite anos adicionais (só faz sentido para ciclo anual)
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo (visível na vitrine do motorista)
        </label>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={loading} className={primaryButtonClass + " w-auto px-6"}>
          {loading ? "Salvando…" : editando ? "Salvar alterações" : "Criar plano"}
        </button>

        {editando && (
          <button type="button" onClick={handleDelete} disabled={deleting} className={dangerButtonClass}>
            {deleting ? "Excluindo…" : "Excluir plano"}
          </button>
        )}
      </div>
    </form>
  );
}
