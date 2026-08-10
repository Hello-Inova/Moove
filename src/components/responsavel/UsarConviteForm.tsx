"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass } from "@/components/ui/form-elements";

type Validacao = {
  motoristaNome: string;
  escolas: { id: string; nome: string }[];
  alunosDisponiveis: { id: string; nome: string }[];
  vagasDisponiveis: number;
};

export function UsarConviteForm() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [validacao, setValidacao] = useState<Validacao | null>(null);
  const [alunoId, setAlunoId] = useState("");
  const [escolaId, setEscolaId] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleValidar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const codigoDigitado = String(form.get("codigo") ?? "");

    const result = await apiPostJson<Validacao>("/api/responsavel/convites/validar", { codigo: codigoDigitado });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setCodigo(codigoDigitado);
    setValidacao(result.data);
    setAlunoId(result.data.alunosDisponiveis[0]?.id ?? "");
    setEscolaId(result.data.escolas[0]?.id ?? "");
  }

  async function handleConfirmar() {
    if (!alunoId || !escolaId) return;
    setLoading(true);
    setFormError(null);

    const result = await apiPostJson<{ motoristaNome: string }>("/api/responsavel/convites/usar", {
      codigo,
      alunoId,
      escolaId,
    });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setSuccess(`Vínculo criado com ${result.data.motoristaNome}!`);
    setValidacao(null);
    setCodigo("");
    router.refresh();
  }

  if (success) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
        <button onClick={() => setSuccess(null)} className={primaryButtonClass}>
          Usar outro código
        </button>
      </div>
    );
  }

  if (validacao) {
    const semVagas = validacao.vagasDisponiveis <= 0;
    const semAlunos = validacao.alunosDisponiveis.length === 0;
    const semEscolas = validacao.escolas.length === 0;

    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Código válido — motorista <strong>{validacao.motoristaNome}</strong>. Escolha o aluno e a escola:
        </p>

        {semVagas && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Você não tem vagas disponíveis na sua assinatura.{" "}
            <Link href="/responsavel/assinatura" className="font-medium underline">
              Assine ou amplie seu plano
            </Link>
            .
          </p>
        )}

        {!semVagas && semAlunos && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Todos os seus alunos já estão vinculados.{" "}
            <Link href="/responsavel/alunos" className="font-medium underline">
              Cadastre outro aluno
            </Link>
            .
          </p>
        )}

        {!semVagas && !semAlunos && semEscolas && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Este motorista ainda não cadastrou nenhuma escola.
          </p>
        )}

        {!semVagas && !semAlunos && !semEscolas && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="alunoId">
                Aluno
              </label>
              <select id="alunoId" value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className={inputClass}>
                {validacao.alunosDisponiveis.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="escolaId">
                Escola
              </label>
              <select id="escolaId" value={escolaId} onChange={(e) => setEscolaId(e.target.value)} className={inputClass}>
                {validacao.escolas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <button onClick={handleConfirmar} disabled={loading} className={primaryButtonClass}>
              {loading ? "Vinculando…" : "Confirmar vínculo"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setValidacao(null)}
          className="w-full text-center text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400"
        >
          Usar outro código
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleValidar} className="space-y-4" noValidate>
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
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Código recebido do motorista, válido por 7 dias.</p>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Verificando…" : "Continuar"}
      </button>
    </form>
  );
}
