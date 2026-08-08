import "server-only";

import { prisma } from "@/lib/prisma";
import {
  PLANOS,
  calcularExpiraEmAssinatura,
  calcularTesteExpiraEm,
  calcularValorAssinatura,
  type TipoPlano,
} from "@/lib/subscription/plans";
import { createMercadoPagoPreference, getMercadoPagoPayment } from "@/lib/payment/mercadopago";
import type { Assinatura } from "@prisma/client";

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

export function diasRestantesTeste(assinatura: Pick<Assinatura, "status" | "testeExpiraEm"> | null): number | null {
  if (!assinatura || assinatura.status !== "TESTE") return null;
  const ms = assinatura.testeExpiraEm.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function assinaturaPermiteAcesso(assinatura: Pick<Assinatura, "status"> | null): boolean {
  return assinatura?.status === "TESTE" || assinatura?.status === "ATIVA";
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
  tipoPlano: TipoPlano;
  qtdAlunos: number;
  anosAdicionais?: number;
}) {
  const resumo = calcularValorAssinatura(params);
  const plano = PLANOS[params.tipoPlano];

  const assinatura = await prisma.assinatura.create({
    data: {
      motoristaId: params.motoristaId,
      tipoPlano: params.tipoPlano,
      cicloCobranca: plano.ciclo,
      qtdAlunosContratados: resumo.alunosContratados,
      anosAdicionais: resumo.anosAdicionais,
      valorPlano: resumo.valorPlano,
      valorAlunosExcedentes: resumo.valorAlunosExcedentes,
      valorAnosAdicionais: resumo.valorAnosAdicionais,
      valorTotal: resumo.valorTotal,
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
 * Chamado pelo webhook do Mercado Pago com o id do pagamento — já revalidado
 * contra a API oficial pelo chamador (ver a rota do webhook). Ativa a
 * assinatura correspondente e cancela outras assinaturas em aberto do mesmo
 * motorista (troca de plano / renovação).
 */
export async function confirmarPagamentoMercadoPago(mpPaymentId: string): Promise<void> {
  const payment = await getMercadoPagoPayment(mpPaymentId);
  if (!payment.externalReference) return;

  const pagamento = await prisma.pagamento.findUnique({
    where: { id: payment.externalReference },
    include: { assinatura: true },
  });
  if (!pagamento) return;

  // Confere se o valor recebido bate com o que cobramos originalmente —
  // proteção extra contra um pagamento adulterado/trocado.
  const valorConfere = Math.abs(Number(pagamento.valor) - payment.transactionAmount) < 0.01;

  if (payment.status === "approved" && valorConfere) {
    if (pagamento.status === "APROVADO") return; // idempotente: webhook pode repetir

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
    return;
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
}
