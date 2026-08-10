"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { apiGet, apiPostJson } from "@/lib/api-client";
import { primaryButtonClass } from "@/components/ui/form-elements";
import { calcularValorAssinaturaResponsavel, formatarBRL, type PlanoDefinicao } from "@/lib/subscription/plans";

const STATUS_MSG: Record<string, { text: string; className: string }> = {
  sucesso: {
    text: "Pagamento aprovado! Pode levar alguns segundos para a assinatura atualizar aqui.",
    className: "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  },
  pendente: {
    text: "Pagamento em análise. Assim que for aprovado, suas vagas são liberadas automaticamente.",
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  falha: {
    text: "O pagamento não foi concluído. Você pode tentar novamente.",
    className: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
};

export function AssinaturaResponsavelClient() {
  const searchParams = useSearchParams();
  const statusPagamento = searchParams.get("pagamento");

  const [planos, setPlanos] = useState<PlanoDefinicao[] | null>(null);
  const [totalAlunos, setTotalAlunos] = useState<number | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      apiGet<{ planos: PlanoDefinicao[] }>("/api/responsavel/planos"),
      apiGet<{ totalAlunos: number }>("/api/responsavel/assinatura"),
    ]).then(([planosResult, assinaturaResult]) => {
      if (cancelado) return;
      if (!planosResult.ok) {
        setLoadError(planosResult.error);
        return;
      }
      setPlanos(planosResult.data.planos);
      if (assinaturaResult.ok) setTotalAlunos(assinaturaResult.data.totalAlunos);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  const plano = useMemo(() => planos?.find((p) => p.codigo === selecionado) ?? null, [planos, selecionado]);

  const resumo = useMemo(() => {
    if (!plano || !totalAlunos) return null;
    return calcularValorAssinaturaResponsavel({ plano, qtdAlunos: totalAlunos });
  }, [plano, totalAlunos]);

  async function handleCheckout() {
    if (!plano) return;
    setLoading(true);
    setError(null);

    const result = await apiPostJson<{ checkoutUrl: string }>("/api/responsavel/assinatura/checkout", {
      tipoPlano: plano.codigo,
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    window.location.href = result.data.checkoutUrl;
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!planos || totalAlunos === null) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando…</p>;
  }

  if (totalAlunos === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        Cadastre pelo menos um aluno em &quot;Meus alunos&quot; antes de escolher um plano.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {statusPagamento && STATUS_MSG[statusPagamento] && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${STATUS_MSG[statusPagamento].className}`}>
          {STATUS_MSG[statusPagamento].text}
        </p>
      )}

      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Você tem <strong>{totalAlunos}</strong> aluno(s) cadastrado(s). O valor abaixo já considera essa quantidade —
        cada aluno adicionado depois exige uma nova assinatura cobrindo o novo total.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {planos.map((p) => {
          const resumoCard = calcularValorAssinaturaResponsavel({ plano: p, qtdAlunos: totalAlunos });
          const selecionadoCard = selecionado === p.codigo;
          return (
            <button
              key={p.codigo}
              type="button"
              onClick={() => {
                setSelecionado(p.codigo);
                setError(null);
              }}
              className={`rounded-2xl border p-5 text-left shadow-sm transition ${
                selecionadoCard
                  ? "border-brand-orange bg-brand-orange-soft dark:border-brand-orange dark:bg-brand-orange/10"
                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900"
              }`}
            >
              {p.destaque && (
                <span className="mb-2 inline-block rounded-full bg-brand-orange px-2 py-0.5 text-xs font-medium text-white">
                  {p.destaque}
                </span>
              )}
              <h3 className="text-lg font-semibold text-brand-navy dark:text-white">{p.label}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{p.cicloLabel}</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatarBRL(p.valorBase)}
                <span className="text-sm font-normal text-neutral-500 dark:text-neutral-400">/aluno</span>
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
                Total para {totalAlunos} aluno(s): <strong>{formatarBRL(resumoCard.valorTotal)}</strong>
              </p>
            </button>
          );
        })}
      </div>

      {plano && resumo && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="text-lg font-semibold text-brand-navy dark:text-white">Assinar plano {plano.label}</h2>
          <div className="mt-4 space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-800">
            <div className="flex justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">
                {resumo.qtdAlunos} aluno(s) × {formatarBRL(resumo.valorPorAluno)}
              </span>
              <span>{formatarBRL(resumo.valorTotal)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-brand-navy dark:border-neutral-700 dark:text-white">
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
