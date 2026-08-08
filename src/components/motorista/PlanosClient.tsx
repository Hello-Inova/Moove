"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { apiPostJson } from "@/lib/api-client";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { PlanCard } from "@/components/motorista/PlanCard";
import { PLANOS, calcularValorAssinatura, formatarBRL, type TipoPlano } from "@/lib/subscription/plans";

const STATUS_MSG: Record<string, { text: string; className: string }> = {
  sucesso: { text: "Pagamento aprovado! Pode levar alguns segundos para o plano atualizar aqui.", className: "bg-green-50 text-green-800 border-green-200" },
  pendente: { text: "Pagamento em análise. Assim que for aprovado, seu plano é ativado automaticamente.", className: "bg-amber-50 text-amber-800 border-amber-200" },
  falha: { text: "O pagamento não foi concluído. Você pode tentar novamente.", className: "bg-red-50 text-red-800 border-red-200" },
};

export function PlanosClient({ tipoPlanoAtual }: { tipoPlanoAtual: TipoPlano | null }) {
  const searchParams = useSearchParams();
  const statusPagamento = searchParams.get("pagamento");

  const [selecionado, setSelecionado] = useState<TipoPlano | null>(null);
  const [qtdAlunos, setQtdAlunos] = useState(5);
  const [anosAdicionais, setAnosAdicionais] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plano = selecionado ? PLANOS[selecionado] : null;

  const resumo = useMemo(() => {
    if (!selecionado) return null;
    return calcularValorAssinatura({ tipoPlano: selecionado, qtdAlunos, anosAdicionais });
  }, [selecionado, qtdAlunos, anosAdicionais]);

  async function handleCheckout() {
    if (!selecionado) return;
    setLoading(true);
    setError(null);

    const result = await apiPostJson<{ checkoutUrl: string }>("/api/motorista/assinatura/checkout", {
      tipoPlano: selecionado,
      qtdAlunos,
      anosAdicionais: plano?.permiteAnosAdicionais ? anosAdicionais : 0,
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    window.location.href = result.data.checkoutUrl;
  }

  return (
    <div className="space-y-8">
      {statusPagamento && STATUS_MSG[statusPagamento] && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${STATUS_MSG[statusPagamento].className}`}>
          {STATUS_MSG[statusPagamento].text}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-3">
        {Object.values(PLANOS).map((p) => (
          <PlanCard
            key={p.tipo}
            plano={p}
            ativo={tipoPlanoAtual === p.tipo}
            selecionado={selecionado === p.tipo}
            onSelecionar={() => {
              setSelecionado(p.tipo);
              setQtdAlunos(Math.max(1, p.alunosGratis || 5));
              setAnosAdicionais(0);
              setError(null);
            }}
          />
        ))}
      </div>

      {plano && resumo && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-navy">Assinar plano {plano.label}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Informe quantos alunos (vínculos) você pretende atender — o valor é calculado na hora.
          </p>

          <div className="mt-4 max-w-xs">
            <label className="mb-1 block text-sm font-medium" htmlFor="qtdAlunos">
              Quantidade de alunos
            </label>
            <input
              id="qtdAlunos"
              type="number"
              min={1}
              value={qtdAlunos}
              onChange={(e) => setQtdAlunos(Math.max(1, Number(e.target.value) || 1))}
              className={inputClass}
            />
          </div>

          {plano.permiteAnosAdicionais && (
            <div className="mt-4 max-w-xs">
              <label className="mb-1 block text-sm font-medium">Anos adicionais além do 1º ano</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAnosAdicionais((n) => Math.max(0, n - 1))}
                  className={secondaryButtonClass + " px-3 py-1.5"}
                >
                  −
                </button>
                <span className="w-8 text-center font-medium">{anosAdicionais}</span>
                <button
                  type="button"
                  onClick={() => setAnosAdicionais((n) => n + 1)}
                  className={secondaryButtonClass + " px-3 py-1.5"}
                >
                  +
                </button>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Cada ano extra soma mais {formatarBRL(plano.valorBase)} (mesmo valor do plano anual).
              </p>
            </div>
          )}

          <div className="mt-6 space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-600">Plano {plano.label} ({plano.cicloLabel.toLowerCase()})</span>
              <span>{formatarBRL(resumo.valorPlano)}</span>
            </div>

            {resumo.alunosGratis > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Desconto — {Math.min(resumo.alunosContratados, resumo.alunosGratis)} aluno(s) grátis incluído(s)</span>
                <span>− {formatarBRL(Math.min(resumo.alunosContratados, resumo.alunosGratis) * plano.valorPorAlunoExcedente)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-neutral-600">
                {resumo.alunosCobrados} aluno(s) cobrado(s) × {formatarBRL(plano.valorPorAlunoExcedente)}
              </span>
              <span>{formatarBRL(resumo.valorAlunosExcedentes)}</span>
            </div>

            {resumo.anosAdicionais > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600">{resumo.anosAdicionais} ano(s) adicional(is)</span>
                <span>{formatarBRL(resumo.valorAnosAdicionais)}</span>
              </div>
            )}

            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-brand-navy">
              <span>Total</span>
              <span>{formatarBRL(resumo.valorTotal)}</span>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button onClick={handleCheckout} disabled={loading} className={primaryButtonClass + " mt-4"}>
            {loading ? "Preparando pagamento…" : "Ir para pagamento"}
          </button>
        </section>
      )}
    </div>
  );
}
