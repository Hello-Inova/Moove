import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, XCircle, Gift, CircleDollarSign, Clock } from "lucide-react";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { getAssinaturaAtual } from "@/lib/subscription/service";
import { prisma } from "@/lib/prisma";
import { cardClass } from "@/components/ui/form-elements";
import { Badge } from "@/components/ui/Badge";
import { PixKeyForm } from "@/components/motorista/PixKeyForm";
import { PushToggle } from "@/components/ui/PushToggle";
import { RevogarButton } from "@/components/motorista/RevogarButton";
import { ReativarButton } from "@/components/motorista/ReativarButton";
import { PagarCobrancasPendentesButton } from "@/components/motorista/PagarCobrancasPendentesButton";
import { CobrancaAlunoSync } from "@/components/motorista/CobrancaAlunoSync";
import { VALOR_MINIMO_ASAAS } from "@/lib/subscription/cobranca-aluno-pagamento";
import { GuideTour, type GuideStep } from "@/components/ui/GuideTour";

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR");
}

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function MotoristaVinculosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const [assinatura, vinculos] = await Promise.all([
    getAssinaturaAtual(motorista.id),
    prisma.vinculo.findMany({
      where: { motoristaId: motorista.id },
      orderBy: { criadoEm: "desc" },
      include: {
        responsavel: { select: { nome: true, email: true, telefone: true } },
        aluno: { select: { nome: true } },
        escola: { select: { nome: true } },
        cobrancas: { where: { status: "PENDENTE" }, orderBy: { criadoEm: "asc" } },
      },
    }),
  ]);

  const assinaturaAtiva = assinatura?.status === "ATIVA";
  const alunosGratis = assinaturaAtiva ? assinatura.alunosGratis : 0;
  const valorPorAlunoExcedente = assinaturaAtiva ? Number(assinatura.valorPorAlunoExcedente) : 0;

  // Mesmo ranking dinâmico usado pelo cron (ver
  // src/lib/subscription/cobranca-aluno.ts): os vínculos ATIVOS mais antigos
  // ficam na faixa grátis; só é informativo aqui, quem decide de fato é o
  // cron na hora do corte.
  const ativosOrdenados = vinculos
    .filter((v) => v.status === "ATIVO")
    .slice()
    .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
  const idsGratis = new Set(ativosOrdenados.slice(0, alunosGratis).map((v) => v.id));

  const ativos = vinculos.filter((v) => v.status === "ATIVO").length;
  const cobrancasPendentesTotal = vinculos.reduce((soma, v) => soma + v.cobrancas.length, 0);
  const valorPendenteTotal = vinculos.reduce(
    (soma, v) => soma + v.cobrancas.reduce((s, c) => s + Number(c.valor), 0),
    0
  );
  const faltaParaMinimo = VALOR_MINIMO_ASAAS - valorPendenteTotal;

  const tourSteps: GuideStep[] = [
    {
      targetId: "tour-vinculos-pix",
      title: "Cadastre sua chave PIX",
      text: "É a chave PIX que você usa pra receber o pagamento do transporte direto das famílias — mantenha atualizada. A cobrança por aluno excedente do plano é separada e paga por você via Asaas (veja abaixo).",
    },
    {
      targetId: "tour-vinculos-push",
      title: "Ative as notificações",
      text: "Receba um aviso na hora quando um convite for aceito ou uma nova cobrança de aluno for gerada, mesmo com o app fechado.",
    },
    {
      targetId: "tour-vinculos-lista",
      title: "Seus alunos vinculados",
      text: "O selo \"Grátis\" mostra os alunos dentro da sua franquia; \"Cobrado\" mostra os que já estão gerando cobrança. As cobranças pendentes aparecem somadas no topo da tela — a Asaas só libera o pagamento a partir de R$5,00, então elas se acumulam até bater esse valor. Quando o botão \"Pagar tudo agora\" aparecer, é só clicar: você paga direto pela Asaas, com PIX ou cartão, e as cobranças são baixadas automaticamente assim que o pagamento é confirmado.",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Alunos</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {ativos} aluno{ativos === 1 ? "" : "s"} vinculado{ativos === 1 ? "" : "s"}
            {assinaturaAtiva && ` · até ${alunosGratis} grátis · R$ ${valorPorAlunoExcedente.toFixed(2)}/excedente a cada 30 dias`}
            {cobrancasPendentesTotal > 0 && ` · ${cobrancasPendentesTotal} cobrança${cobrancasPendentesTotal === 1 ? "" : "s"} pendente${cobrancasPendentesTotal === 1 ? "" : "s"}`}
          </p>
        </div>
        <GuideTour steps={tourSteps} />
      </div>

      <Suspense fallback={null}>
        <CobrancaAlunoSync />
      </Suspense>

      {cobrancasPendentesTotal > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-300">
              {formatarValor(valorPendenteTotal)} pendente
              {cobrancasPendentesTotal > 1 && ` (${cobrancasPendentesTotal} cobranças)`}
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-400/80">
              {valorPendenteTotal >= VALOR_MINIMO_ASAAS
                ? "Pague tudo de uma vez, direto pela Asaas."
                : `A Asaas só libera o pagamento a partir de R$ ${VALOR_MINIMO_ASAAS.toFixed(2)} — falta ${formatarValor(faltaParaMinimo)} pra liberar (as cobranças se acumulam sozinhas a cada corte de 30 dias).`}
            </p>
          </div>
          {valorPendenteTotal >= VALOR_MINIMO_ASAAS && <PagarCobrancasPendentesButton />}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <section id="tour-vinculos-pix" className={cardClass}>
          <PixKeyForm chavePixAtual={motorista.chavePix} />
        </section>

        <div id="tour-vinculos-push">
          <PushToggle
            title="Notificações"
            description="Receba um aviso quando um convite for aceito ou uma cobrança de aluno for gerada — mesmo com o app fechado."
            subscribeUrl="/api/motorista/push/subscribe"
            unsubscribeUrl="/api/motorista/push/unsubscribe"
          />
        </div>
      </div>

      <div id="tour-vinculos-lista" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vinculos.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 sm:col-span-2 lg:col-span-3">
            Nenhum aluno vinculado ainda.
          </p>
        )}

        {vinculos.map((v) => {
          const gratis = idsGratis.has(v.id);
          return (
            <div key={v.id} className={cardClass + " flex flex-col gap-3"}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{v.aluno.nome}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{v.responsavel.nome}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{v.escola?.nome ?? "Escola não definida"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {v.status === "ATIVO" ? (
                    <Badge variant="green" icon={CheckCircle2}>Ativo</Badge>
                  ) : (
                    <Badge variant="red" icon={XCircle}>Revogado</Badge>
                  )}
                  {v.status === "ATIVO" &&
                    assinaturaAtiva &&
                    (gratis ? (
                      <Badge variant="blue" icon={Gift}>Grátis</Badge>
                    ) : (
                      <Badge variant="amber" icon={CircleDollarSign}>Cobrado</Badge>
                    ))}
                </div>
              </div>

              {v.status === "ATIVO" && v.proximaCobrancaEm && (
                <p className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Próximo corte: {formatarData(v.proximaCobrancaEm)}
                </p>
              )}

              {v.cobrancas.length > 0 && (
                <div className="space-y-1.5 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
                  {v.cobrancas.map((c) => (
                    <p key={c.id} className="text-xs text-amber-800 dark:text-amber-300">
                      {formatarValor(Number(c.valor))} · ciclo {formatarData(c.cicloInicio)}–{formatarData(c.cicloFim)}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {v.status === "ATIVO" ? (
                  <RevogarButton
                    url={`/api/motorista/vinculos/${v.id}/revogar`}
                    confirmMessage="Revogar este vínculo? O responsável perde acesso imediato à localização."
                  />
                ) : (
                  <ReativarButton url={`/api/motorista/vinculos/${v.id}/reativar`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
