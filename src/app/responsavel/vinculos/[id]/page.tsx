import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Phone, MessageCircle, School, Wallet, FileText, Truck } from "lucide-react";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { cardClass } from "@/components/ui/form-elements";
import { Badge } from "@/components/ui/Badge";
import { ResponsavelShell } from "@/components/responsavel/ResponsavelShell";
import { linkWhatsApp } from "@/lib/whatsapp";

const PERIODO_LABEL: Record<string, string> = { MANHA: "Manhã", TARDE: "Tarde", INTEGRAL: "Integral", NOITE: "Noite" };
const MENSALIDADE_STATUS_VARIANT = {
  PENDENTE: "amber",
  PAGO: "green",
  CANCELADO: "neutral",
} as const;
const MENSALIDADE_STATUS_LABEL: Record<string, string> = { PENDENTE: "Pendente", PAGO: "Paga", CANCELADO: "Cancelada" };

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR");
}

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarMesReferencia(data: Date): string {
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Detalhe do vínculo pro responsável — histórico de mensalidade e contrato
 * (Fase 5 do plano de implantação). Somente leitura: toda edição continua
 * exclusiva do motorista em /motorista/vinculos/[id].
 */
export default async function ResponsavelVinculoPage({ params }: { params: Promise<{ id: string }> }) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) redirect("/responsavel/login");

  const { id } = await params;

  const vinculo = await prisma.vinculo.findUnique({
    where: { id },
    include: {
      motorista: { select: { nome: true, telefone: true, chavePix: true } },
      aluno: { select: { nome: true } },
      escola: { select: { nome: true } },
      mensalidades: { orderBy: { mesReferencia: "desc" } },
      contratos: { orderBy: { criadoEm: "desc" } },
    },
  });

  if (!vinculo || vinculo.responsavelId !== responsavel.id) notFound();

  const { motorista, aluno, escola, mensalidades, contratos } = vinculo;
  const contratoMaisRecente = contratos[0] ?? null;

  const whatsappHref = linkWhatsApp(
    motorista.telefone,
    `Olá, ${motorista.nome}! Aqui é o responsável por ${aluno.nome}.`
  );

  return (
    <ResponsavelShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <Link
            href="/responsavel/dashboard"
            aria-label="Voltar"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{aluno.nome}</h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              {vinculo.status === "ATIVO" ? (
                <Badge variant="green">Ativo</Badge>
              ) : (
                <Badge variant="red">Revogado</Badge>
              )}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className={cardClass}>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Truck className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              Motorista
            </h2>
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">{motorista.nome}</p>
              <p className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {motorista.telefone}
              </p>
            </div>
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Falar no WhatsApp
              </a>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <School className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              Escola
            </h2>
            <div className="space-y-1.5 text-sm text-neutral-600 dark:text-neutral-300">
              <p>{escola?.nome ?? "Não definida"}</p>
              <p>Período: {vinculo.periodo ? PERIODO_LABEL[vinculo.periodo] : "Não informado"}</p>
            </div>
          </section>
        </div>

        <section className={cardClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Wallet className="h-4 w-4 text-neutral-400" aria-hidden="true" />
              Mensalidade do transporte
            </h2>
          </div>

          {vinculo.valorMensalidade ? (
            <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
              {formatarValor(Number(vinculo.valorMensalidade))} por mês · todo dia {vinculo.diaPagamentoMensalidade}
              {vinculo.vigenciaInicio && ` · desde ${formatarData(vinculo.vigenciaInicio)}`}
              {vinculo.vigenciaFim && ` até ${formatarData(vinculo.vigenciaFim)}`}
            </p>
          ) : (
            <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
              O motorista ainda não configurou o valor da mensalidade.
            </p>
          )}

          {motorista.chavePix && (
            <p className="mb-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Chave PIX do motorista: <span className="font-medium">{motorista.chavePix}</span>
            </p>
          )}

          {mensalidades.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma mensalidade gerada ainda.</p>
          ) : (
            <div className="space-y-2">
              {mensalidades.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">{formatarMesReferencia(m.mesReferencia)}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatarValor(Number(m.valor))}
                      {m.pagoEm && ` · pago em ${formatarData(m.pagoEm)}`}
                    </p>
                  </div>
                  <Badge variant={MENSALIDADE_STATUS_VARIANT[m.status]}>{MENSALIDADE_STATUS_LABEL[m.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Contrato de transporte
          </h2>

          {!contratoMaisRecente ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum contrato registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{contratoMaisRecente.titulo}</p>
                {contratoMaisRecente.assinadoEm && (
                  <Badge variant="green">Assinado em {formatarData(contratoMaisRecente.assinadoEm)}</Badge>
                )}
              </div>
              {contratoMaisRecente.prazoMeses && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Prazo: {contratoMaisRecente.prazoMeses} meses
                  {contratoMaisRecente.vigenciaInicio && ` · desde ${formatarData(contratoMaisRecente.vigenciaInicio)}`}
                  {contratoMaisRecente.vigenciaFim && ` até ${formatarData(contratoMaisRecente.vigenciaFim)}`}
                </p>
              )}
              {contratoMaisRecente.textoContrato && (
                <pre className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {contratoMaisRecente.textoContrato}
                </pre>
              )}
              {contratoMaisRecente.arquivoUrl && (
                <a
                  href={contratoMaisRecente.arquivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-medium text-brand-orange-dark underline underline-offset-2"
                >
                  Ver documento anexado
                </a>
              )}

              {contratos.length > 1 && (
                <p className="text-xs text-neutral-400">
                  + {contratos.length - 1} contrato{contratos.length - 1 === 1 ? "" : "s"} anterior
                  {contratos.length - 1 === 1 ? "" : "es"} no histórico.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </ResponsavelShell>
  );
}
