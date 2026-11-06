"use client";

import { useState } from "react";
import { Copy, Ticket, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { apiPostJson } from "@/lib/api-client";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";

type ConviteCriado = {
  codigo: string;
  expiraEm: string;
};

/** Gera o código usado por responsáveis que já têm conta e alunos no Moove. */
export function GerarConviteResponsavelExistente() {
  const [loading, setLoading] = useState(false);
  const [convite, setConvite] = useState<ConviteCriado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setLoading(true);
    setErro(null);
    const result = await apiPostJson<ConviteCriado>("/api/motorista/convites", {});
    setLoading(false);

    if (!result.ok) {
      setErro(result.error);
      return;
    }

    setConvite(result.data);
    toast.success("Código de convite gerado.");
  }

  async function copiar() {
    if (!convite) return;
    try {
      await navigator.clipboard.writeText(convite.codigo);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  }

  return (
    <section className="rounded-2xl border border-brand-orange/30 bg-brand-orange-soft/40 p-5 dark:border-brand-orange/30 dark:bg-brand-orange/10">
      <div className="flex gap-3">
        <div className="mt-0.5 rounded-xl bg-brand-orange p-2 text-white">
          <UserCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-semibold text-neutral-900 dark:text-white">Responsável já cadastrado?</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            Gere um código e envie para a família. Ela entra na conta, abre <strong>Usar convite</strong>, escolhe o aluno já cadastrado e confirma o vínculo.
          </p>
        </div>
      </div>

      {convite ? (
        <div className="mt-4 rounded-xl border border-brand-orange/30 bg-white p-4 dark:bg-neutral-900">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Código de convite</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-neutral-100 px-3 py-2 font-mono text-lg font-semibold tracking-[0.2em] text-neutral-900 dark:bg-neutral-800 dark:text-white">
              {convite.codigo}
            </code>
            <button type="button" onClick={copiar} className={secondaryButtonClass + " inline-flex w-auto items-center gap-1.5 px-3 py-2 text-sm"}>
              <Copy className="h-4 w-4" aria-hidden="true" /> Copiar código
            </button>
          </div>
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            Válido até {new Date(convite.expiraEm).toLocaleDateString("pt-BR")} e utilizável uma única vez.
          </p>
          <button type="button" onClick={gerar} disabled={loading} className="mt-4 text-sm font-medium text-brand-orange-dark underline underline-offset-2 dark:text-brand-orange-light">
            {loading ? "Gerando…" : "Gerar outro código"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={gerar} disabled={loading} className={primaryButtonClass + " mt-4 inline-flex w-auto items-center gap-2 px-4"}>
          <Ticket className="h-4 w-4" aria-hidden="true" />
          {loading ? "Gerando código…" : "Gerar código de vínculo"}
        </button>
      )}

      {erro && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{erro}</p>}
    </section>
  );
}
