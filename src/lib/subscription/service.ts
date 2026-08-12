import "server-only";

import { prisma } from "@/lib/prisma";
import {
  calcularExpiraEmAssinatura,
  calcularTesteExpiraEm,
  calcularValorAssinaturaMotorista,
  contaEmTeste,
} from "@/lib/subscription/plans";
import { buscarPlanoPorCodigo } from "@/lib/subscription/planos-service";
import { createMercadoPagoPreference, getMercadoPagoPayment } from "@/lib/payment/mercadopago";
import type { Assinatura } from "@prisma/client";

export { contaEmTeste, diasRestantesConta } from "@/lib/subscription/plans";

export class PlanoInexistenteError extends Error {}

/**
 * Assinatura "atual" de um motorista: a mais recente. Expira preguiçosamente
 * (mesmo padrão usado para convites) — se o teste ou o ciclo pago já
 * passaram da data, o status é corrigido para EXPIRADA na primeira leitura.
 */
export async function getAssinaturaAtual(motoristaId: string): Promise<Assinatura | null> {
  const assinatura = await prisma.assinatura.findFirst({
    where: { motoristaId },
    orderBy: { criadoEm: "desc" },
  });
  if (!assinatura) return null;

  const agora = Date.now();

  if (assinatura.status === "TESTE" && assinatura.testeExpiraEm.getTime() < agora) {
    return prisma.assinatura.update({ where: { id: assinatura.id }, data: { status: "EXPIRADA" } });
  }
  if (assinatura.status === "ATIVA" && assinatura.expiraEm && assinatura.expiraEm.getTime() < agora) {
    return prisma.assinatura.update({ where: { id: assinatura.id }, data: { status: "EXPIRADA" } });
  }

  return assinatura;
}

/**
 * Acesso ao sistema é liberado por dois caminhos independentes: o teste
 * grátis de 7 dias em nível de conta (`testeExpiraEm`, ver schema) OU uma
 * assinatura paga ATIVA. O status "TESTE" que uma Assinatura ainda pode ter
 * (enquanto o checkout de um plano está pendente de pagamento) não conta
 * mais pra liberar acesso — só existia pra granular o teste por plano
 * escolhido, o que foi substituído pelo teste em nível de conta.
 */
export function motoristaTemAcesso(
  motorista: { testeExpiraEm: Date },
  assinatura: Pick<Assinatura, "status"> | null
): boolean {
  return contaEmTeste(motorista.testeExpiraEm) || assinatura?.status === "ATIVA";
}

/**
 * O responsável não paga mais nada diretamente — quem passou a pagar por
 * aluno vinculado foi o motorista (ver `CobrancaAluno` e
 * `src/lib/subscription/cobranca-aluno.ts`). Mantida como função (em vez de
 * remover todos os call sites) só pra não precisar tocar em
 * `ResponsavelShell`/`AccessGate` — sempre libera acesso.
 */
export function responsavelTemAcesso(): boolean {
  return true;
}

/**
 * Cria uma nova Assinatura (em TESTE) + o Pagamento pendente + a preference
 * de checkout no Mercado Pago. Não mexe em nenhuma assinatura anterior do
 * motorista ainda — isso só acontece quando o pagamento é confirmado (ver
 * `confirmarPagamentoWebhook`), pra não cortar o acesso de quem já é
 * assinante enquanto ele está só cotando um upgrade.
 */
export async function criarAssinaturaComCheckout(params: {
  motoristaId: string;
  motoristaNome: string;
  motoristaEmail: string;
  tipoPlano: string;
  anosAdicionais?: number;
}) {
  const plano = await buscarPlanoPorCodigo(params.tipoPlano);
  if (!plano || !plano.ativo) {
    throw new PlanoInexistenteError("Este plano não está mais disponível. Escolha outro plano.");
  }

  // Mensalidade fixa da plataforma — a cobrança por aluno vinculado é
  // separada, gerada aluno a aluno pelo cron (ver
  // src/lib/subscription/cobranca-aluno.ts), não entra nesse checkout.
  const resumo = calcularValorAssinaturaMotorista({ plano, anosAdicionais: params.anosAdicionais });

  const assinatura = await prisma.assinatura.create({
    data: {
      motoristaId: params.motoristaId,
      tipoPlano: plano.codigo,
      planoLabel: plano.label,
      cicloCobranca: plano.ciclo,
      qtdAlunosContratados: 0,
      anosAdicionais: resumo.anosAdicionais,
      valorPlano: resumo.valorPlano,
      valorAlunosExcedentes: 0,
      valorAnosAdicionais: resumo.valorAnosAdicionais,
      valorTotal: resumo.valorTotal,
      // Snapshot da regra de cobrança por aluno vigente no plano no momento
      // da assinatura (ver comentário no schema, model Assinatura) — usado
      // pelo cron de cobrança (src/lib/subscription/cobranca-aluno.ts).
      alunosGratis: plano.alunosGratis,
      valorPorAlunoExcedente: plano.valorPorAlunoExcedente,
      testeExpiraEm: calcularTesteExpiraEm(),
    },
  });

  const pagamento = await prisma.pagamento.create({
    data: { assinaturaId: assinatura.id, valor: resumo.valorTotal },
  });

  const anosLabel = resumo.anosAdicionais > 0 ? ` + ${resumo.anosAdicionais} ano(s) extra` : "";
  const preference = await createMercadoPagoPreference({
    titulo: `Moove — Plano ${plano.label} (${plano.cicloLabel.toLowerCase()}${anosLabel})`,
    valor: resumo.valorTotal,
    externalReference: pagamento.id,
    payerEmail: params.motoristaEmail,
  });

  await prisma.pagamento.update({
    where: { id: pagamento.id },
    data: { gatewayPreferenceId: preference.id, checkoutUrl: preference.initPoint },
  });

  return { assinatura, checkoutUrl: preference.initPoint };
}

/**
 * Uso administrativo (painel admin): ativa uma assinatura pro motorista sem
 * passar pelo Mercado Pago — útil pra suporte/teste. Cria a assinatura já
 * como ATIVA (0 alunos excedentes, sem anos adicionais) e cancela qualquer
 * outra TESTE/ATIVA existente, no mesmo padrão da confirmação de pagamento.
 */
export async function forcarAssinaturaAtiva(motoristaId: string, tipoPlano: string): Promise<Assinatura> {
  const plano = await buscarPlanoPorCodigo(tipoPlano);
  if (!plano) throw new PlanoInexistenteError("Plano não encontrado.");

  const expiraEm = calcularExpiraEmAssinatura(plano.ciclo, 0);

  return prisma.$transaction(async (tx) => {
    const assinatura = await tx.assinatura.create({
      data: {
        motoristaId,
        tipoPlano: plano.codigo,
        planoLabel: plano.label,
        cicloCobranca: plano.ciclo,
        qtdAlunosContratados: 0,
        valorPlano: plano.valorBase,
        valorAlunosExcedentes: 0,
        valorTotal: plano.valorBase,
        alunosGratis: plano.alunosGratis,
        valorPorAlunoExcedente: plano.valorPorAlunoExcedente,
        status: "ATIVA",
        testeExpiraEm: new Date(),
        inicioEm: new Date(),
        expiraEm,
      },
    });

    await tx.assinatura.updateMany({
      where: { motoristaId, id: { not: assinatura.id }, status: { in: ["TESTE", "ATIVA"] } },
      data: { status: "CANCELADA" },
    });

    return assinatura;
  });
}

/**
 * Chamado pelo webhook do Mercado Pago com o id do pagamento — já revalidado
 * contra a API oficial pelo chamador (ver a rota do webhook). Ativa a
 * assinatura correspondente e cancela outras assinaturas em aberto do mesmo
 * motorista (troca de plano / renovação).
 */
export async function confirmarPagamentoMercadoPago(mpPaymentId: string): Promise<boolean> {
  const payment = await getMercadoPagoPayment(mpPaymentId);
  if (!payment.externalReference) return false;

  const pagamento = await prisma.pagamento.findUnique({
    where: { id: payment.externalReference },
    include: { assinatura: true },
  });
  if (!pagamento) return false;

  // Confere se o valor recebido bate com o que cobramos originalmente —
  // proteção extra contra um pagamento adulterado/trocado.
  const valorConfere = Math.abs(Number(pagamento.valor) - payment.transactionAmount) < 0.01;

  if (payment.status === "approved" && valorConfere) {
    if (pagamento.status === "APROVADO") return true; // idempotente: webhook pode repetir

    await prisma.$transaction(async (tx) => {
      await tx.pagamento.update({
        where: { id: pagamento.id },
        data: { status: "APROVADO", gatewayPagamentoId: String(payment.id), pagoEm: new Date() },
      });

      const assinatura = pagamento.assinatura;
      const expiraEm = calcularExpiraEmAssinatura(assinatura.cicloCobranca, assinatura.anosAdicionais);

      await tx.assinatura.update({
        where: { id: assinatura.id },
        data: { status: "ATIVA", inicioEm: new Date(), expiraEm },
      });

      await tx.assinatura.updateMany({
        where: {
          motoristaId: assinatura.motoristaId,
          id: { not: assinatura.id },
          status: { in: ["TESTE", "ATIVA"] },
        },
        data: { status: "CANCELADA" },
      });
    });
    return true;
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        status: payment.status === "rejected" ? "RECUSADO" : "CANCELADO",
        gatewayPagamentoId: String(payment.id),
      },
    });
  }
  return true;
}

