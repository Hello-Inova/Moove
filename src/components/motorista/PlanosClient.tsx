"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { apiGet, apiPostJson } from "@/lib/api-client";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PlanCard } from "@/components/motorista/PlanCard";
import { calcularValorAssinaturaMotorista, formatarBRL, type PlanoDefinicao } from "@/lib/subscription/plans";

const STATUS_MSG: Record<string, { text: string; className: string }> = {
  sucesso: {
    text: "Pagamento aprovado! Pode levar alguns segundos para o plano atualizar aqui.",
    className: "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900",
  },
  pendente: {
    text: "Pagamento em análise. Assim que for aprovado, seu plano é ativado automaticamente.",
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  falha: {
    text: "O pagamento não foi concluído. Você pode tentar novamente.",
    className: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  },
};

export function PlanosClient({ tipoPlanoAtual }: { tipoPlanoAtual: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusPagamento = searchParams.get("pagamento");

  const [planos, setPlanos] = useState<PlanoDefinicao[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [anosAdicionais, setAnosAdicionais] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiGet<{ planos: PlanoDefinicao[] }>("/api/motorista/planos").then((result) => {
      if (cancelado) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setPlanos(result.data.planos);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Rede de segurança contra falha do webhook da Asaas: revalida direto na
  // API deles se houver um pagamento pendente do motorista, em vez de
  // depender só da notificação assíncrona chegar. Roda sempre que a tela
  // abre (não só no retorno do checkout) — barato quando não há nada
  // pendente, e corrige qualquer assinatura que tenha ficado presa.
  useEffect(() => {
    let cancelado = false;
    apiPostJson<{ tipoPlanoAtual: string | null }>("/api/motorista/assinatura/sincronizar", {}).then((result) => {
      if (cancelado || !result.ok) return;
      if (result.data.tipoPlanoAtual && result.data.tipoPlanoAtual !== tipoPlanoAtual) {
        router.refresh();
      }
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plano = useMemo(() => planos?.find((p) => p.codigo === selecionado) ?? null, [planos, selecionado]);

  const resumo = useMemo(() => {
    if (!plano) return null;
    return calcularValorAssinaturaMotorista({ plano, anosAdicionais });
  }, [plano, anosAdicionais]);

  async function handleCheckout() {
    if (!plano) return;
    setLoading(true);
    setError(null);

    const result = await apiPostJson<{ checkoutUrl: string }>("/api/motorista/assinatura/checkout", {
      tipoPlano: plano.codigo,
      anosAdicionais: plano.permiteAnosAdicionais ? anosAdicionais : 0,
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }

    window.location.href = result.data.checkoutUrl;
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  if (!planos) {
    return (
      <div className="grid gap-6 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (planos.length === 0) {
    return (
      <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        Nenhum plano disponível no momento. Volte mais tarde.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {statusPagamento && STATUS_MSG[statusPagamento] && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${STATUS_MSG[statusPagamento].className}`}>
          {STATUS_MSG[statusPagamento].text}
        </p>
      )}

      <div id="tour-planos-cards" className="grid gap-6 sm:grid-cols-3">
        {planos.map((p) => (
          <PlanCard
            key={p.codigo}
            plano={p}
            ativo={tipoPlanoAtual === p.codigo}
            selecionado={selecionado === p.codigo}
            onSelecionar={() => {
              setSelecionado(p.codigo);
              setAnosAdicionais(0);
              setError(null);
            }}
          />
        ))}
      </div>

      {plano && resumo && (
        <section
          id="tour-planos-resumo"
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <h2 className="text-lg font-semibold text-brand-navy dark:text-white">Assinar plano {plano.label}</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Valor fixo da plataforma abaixo. A cobrança por aluno excedente (ver detalhes no card do plano) é
            separada — gerada automaticamente a cada 30 dias de vínculo ativo, cobrada por você direto do
            responsável via PIX (veja em &quot;Alunos&quot;).
          </p>

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
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Cada ano extra soma mais {formatarBRL(plano.valorBase)} (mesmo valor do plano anual).
              </p>
            </div>
          )}

          <div className="mt-6 space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-800">
            <div className="flex justify-between">
              <span className="text-neutral-600 dark:text-neutral-300">
                Plano {plano.label} ({plano.cicloLabel.toLowerCase()})
              </span>
              <span>{formatarBRL(resumo.valorPlano)}</span>
            </div>

            {resumo.anosAdicionais > 0 && (
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-300">{resumo.anosAdicionais} ano(s) adicional(is)</span>
                <span>{formatarBRL(resumo.valorAnosAdicionais)}</span>
              </div>
            )}

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
