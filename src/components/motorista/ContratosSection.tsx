"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FileText, Plus, Trash2, ExternalLink } from "lucide-react";

import { apiPostJson, apiDelete } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { useConfirm } from "@/components/ui/ConfirmProvider";

export type ContratoListagem = {
  id: string;
  titulo: string;
  observacoes: string | null;
  arquivoUrl: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  criadoEm: string;
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function ContratosSection({ vinculoId, contratosIniciais }: { vinculoId: string; contratosIniciais: ContratoListagem[] }) {
  const confirm = useConfirm();
  const [contratos, setContratos] = useState(contratosIniciais);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const payload = {
      titulo: String(form.get("titulo") ?? ""),
      observacoes: String(form.get("observacoes") ?? "").trim() || null,
      arquivoUrl: String(form.get("arquivoUrl") ?? "").trim() || null,
      vigenciaInicio: String(form.get("vigenciaInicio") ?? "") || null,
      vigenciaFim: String(form.get("vigenciaFim") ?? "") || null,
    };

    const result = await apiPostJson<{ contrato: ContratoListagem }>(`/api/motorista/vinculos/${vinculoId}/contratos`, payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    setContratos((atual) => [result.data.contrato, ...atual]);
    setMostrarForm(false);
    toast.success("Contrato adicionado.");
  }

  async function handleExcluir(id: string) {
    if (!(await confirm("Excluir este contrato?", { danger: true, confirmLabel: "Excluir" }))) return;
    const result = await apiDelete(`/api/motorista/contratos/${id}`);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setContratos((atual) => atual.filter((c) => c.id !== id));
    toast.success("Contrato excluído.");
  }

  return (
    <div className="space-y-3">
      {contratos.length === 0 && !mostrarForm && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum contrato registrado ainda.</p>
      )}

      {contratos.map((c) => (
        <div key={c.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
            <div>
              <p className="font-medium">{c.titulo}</p>
              {c.observacoes && <p className="text-sm text-neutral-500 dark:text-neutral-400">{c.observacoes}</p>}
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {c.vigenciaInicio && `Vigência desde ${formatarData(c.vigenciaInicio)}`}
                {c.vigenciaFim && ` até ${formatarData(c.vigenciaFim)}`}
                {!c.vigenciaInicio && `Adicionado em ${formatarData(c.criadoEm)}`}
              </p>
              {c.arquivoUrl && (
                <a
                  href={c.arquivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Ver arquivo <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleExcluir(c.id)}
            aria-label="Excluir contrato"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}

      {mostrarForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-700" noValidate>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="titulo">
              Título
            </label>
            <input id="titulo" name="titulo" required placeholder="Ex.: Contrato de transporte 2026" className={inputClass} />
            <FieldError message={issues.titulo?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="observacoes">
              Observações (opcional)
            </label>
            <textarea id="observacoes" name="observacoes" rows={3} className={inputClass} />
            <FieldError message={issues.observacoes?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="arquivoUrl">
              Link do arquivo (opcional)
            </label>
            <input id="arquivoUrl" name="arquivoUrl" type="url" placeholder="https://..." className={inputClass} />
            <FieldError message={issues.arquivoUrl?.[0]} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="vigenciaInicio">
                Início da vigência (opcional)
              </label>
              <input id="vigenciaInicio" name="vigenciaInicio" type="date" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="vigenciaFim">
                Fim da vigência (opcional)
              </label>
              <input id="vigenciaFim" name="vigenciaFim" type="date" className={inputClass} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setMostrarForm(false)} className={secondaryButtonClass} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className={primaryButtonClass + " sm:w-auto"}>
              {saving ? "Salvando…" : "Adicionar"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarForm(true)}
          className={secondaryButtonClass + " inline-flex w-auto items-center gap-1.5 px-3 py-1.5 text-sm"}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Adicionar contrato
        </button>
      )}
    </div>
  );
}
