import "server-only";

import { prisma } from "@/lib/prisma";
import {
  calcularExpiraEmAssinatura,
  calcularTesteExpiraEm,
  calcularValorAssinaturaMotorista,
  calcularValorAssinaturaResponsavel,
  contaEmTeste,
} from "@/lib/subscription/plans";
import { buscarPlanoPorCodigo } from "@/lib/subscription/planos-service";
import { createMercadoPagoPreference, getMercadoPagoPayment } from "@/lib/payment/mercadopago";
import type { Assinatura, AssinaturaResponsavel } from "@prisma/client";

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

export function responsavelTemAcesso(
  responsavel: { testeExpiraEm: Date },
  assinatura: Pick<AssinaturaResponsavel, "status"> | null
): boolean {
  return contaEmTeste(responsavel.testeExpiraEm) || assinatura?.status === "ATIVA";
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

  // Motorista paga um valor fixo pela plataforma — não depende mais de
  // quantos alunos ele tem vinculados (isso agora é cobrado do
  // responsável, ver criarAssinaturaResponsavelComCheckout).
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

// ---------------------------------------------------------------------------
// Assinatura do RESPONSÁVEL — cobrança por aluno (ver plans.ts). Sem período
// de teste: enquanto não há assinatura ATIVA cobrindo a quantidade de
// alunos cadastrados, o responsável não consegue usar códigos de convite
// (ver `vagasDisponiveisParaVincular` e a rota de convites).
// ---------------------------------------------------------------------------

/** Assinatura "atual" do responsável: a mais recente. Expira preguiçosamente, igual à do motorista. */
export async function getAssinaturaResponsavelAtual(responsavelId: string): Promise<AssinaturaResponsavel | null> {
  const assinatura = await prisma.assinaturaResponsavel.findFirst({
    where: { responsavelId },
    orderBy: { criadoEm: "desc" },
  });
  if (!assinatura) return null;

  if (assinatura.status === "ATIVA" && assinatura.expiraEm && assinatura.expiraEm.getTime() < Date.now()) {
    return prisma.assinaturaResponsavel.update({ where: { id: assinatura.id }, data: { status: "EXPIRADA" } });
  }

  return assinatura;
}

/**
 * Quantos "assentos" de aluno o responsável ainda pode vincular a um
 * motorista: quantidade contratada na assinatura ATIVA mais recente, menos
 * os vínculos ATIVOS que ele já tem. Nunca negativo.
 *
 * Durante o teste grátis de 7 dias (nível de conta, ver `testeExpiraEm`), o
 * responsável pode vincular livremente — retorna um número "infinito" como
 * sentinela (chamadores que exibem esse valor devem tratar esse caso à
 * parte em vez de mostrar o número cru; ver `/api/responsavel/assinatura`).
 */
export async function vagasDisponiveisParaVincular(responsavelId: string): Promise<number> {
  const responsavel = await prisma.responsavel.findUnique({
    where: { id: responsavelId },
    select: { testeExpiraEm: true },
  });
  if (responsavel && contaEmTeste(responsavel.testeExpiraEm)) return Number.MAX_SAFE_INTEGER;

  const assinatura = await getAssinaturaResponsavelAtual(responsavelId);
  if (!assinatura || assinatura.status !== "ATIVA") return 0;

  const vinculosAtivos = await prisma.vinculo.count({
    where: { responsavelId, status: "ATIVO" },
  });

  return Math.max(0, assinatura.qtdAlunosContratados - vinculosAtivos);
}

/**
 * Cria a assinatura (PENDENTE, sem teste) + Pagamento + preference de
 * checkout no Mercado Pago para o responsável. `qtdAlunos` é a quantidade
 * de alunos que o responsável já tem cadastrados (ver `/api/responsavel/alunos`)
 * — o valor cobrado é plano.valorBase (valor por aluno) × qtdAlunos.
 */
export async function criarAssinaturaResponsavelComCheckout(params: {
  responsavelId: string;
  responsavelNome: string;
  responsavelEmail: string;
  tipoPlano: string;
  qtdAlunos: number;
}) {
  const plano = await buscarPlanoPorCodigo(params.tipoPlano);
  if (!plano || !plano.ativo || plano.publico !== "RESPONSAVEL") {
    throw new PlanoInexistenteError("Este plano não está mais disponível. Escolha outro plano.");
  }

  const resumo = calcularValorAssinaturaResponsavel({ plano, qtdAlunos: params.qtdAlunos });

  const assinatura = await prisma.assinaturaResponsavel.create({
    data: {
      responsavelId: params.responsavelId,
      tipoPlano: plano.codigo,
      planoLabel: plano.label,
      cicloCobranca: plano.ciclo,
      qtdAlunosContratados: resumo.qtdAlunos,
      valorPorAluno: resumo.valorPorAluno,
      valorTotal: resumo.valorTotal,
    },
  });

  const pagamento = await prisma.pagamentoResponsavel.create({
    data: { assinaturaId: assinatura.id, valor: resumo.valorTotal },
  });

  const preference = await createMercadoPagoPreference({
    titulo: `Moove — Plano ${plano.label} (${plano.cicloLabel.toLowerCase()}) · ${resumo.qtdAlunos} aluno(s)`,
    valor: resumo.valorTotal,
    externalReference: pagamento.id,
    payerEmail: params.responsavelEmail,
    backUrlPath: "/responsavel/assinatura",
  });

  await prisma.pagamentoResponsavel.update({
    where: { id: pagamento.id },
    data: { gatewayPreferenceId: preference.id, checkoutUrl: preference.initPoint },
  });

  return { assinatura, checkoutUrl: preference.initPoint };
}

/**
 * Chamado pelo webhook do Mercado Pago quando o pagamento referenciado é de
 * um PagamentoResponsavel (não de um Pagamento de motorista) — ver a rota
 * do webhook, que tenta um e depois o outro pelo id de referência.
 */
export async function confirmarPagamentoResponsavelMercadoPago(mpPaymentId: string): Promise<boolean> {
  const payment = await getMercadoPagoPayment(mpPaymentId);
  if (!payment.externalReference) return false;

  const pagamento = await prisma.pagamentoResponsavel.findUnique({
    where: { id: payment.externalReference },
    include: { assinatura: true },
  });
  if (!pagamento) return false;

  const valorConfere = Math.abs(Number(pagamento.valor) - payment.transactionAmount) < 0.01;

  if (payment.status === "approved" && valorConfere) {
    if (pagamento.status === "APROVADO") return true; // idempotente

    await prisma.$transaction(async (tx) => {
      await tx.pagamentoResponsavel.update({
        where: { id: pagamento.id },
        data: { status: "APROVADO", gatewayPagamentoId: String(payment.id), pagoEm: new Date() },
      });

      const assinatura = pagamento.assinatura;
      const expiraEm = calcularExpiraEmAssinatura(assinatura.cicloCobranca, 0);

      await tx.assinaturaResponsavel.update({
        where: { id: assinatura.id },
        data: { status: "ATIVA", inicioEm: new Date(), expiraEm },
      });

      await tx.assinaturaResponsavel.updateMany({
        where: {
          responsavelId: assinatura.responsavelId,
          id: { not: assinatura.id },
          status: { in: ["PENDENTE", "ATIVA"] },
        },
        data: { status: "CANCELADA" },
      });
    });
    return true;
  }

  if (payment.status === "rejected" || payment.status === "cancelled") {
    await prisma.pagamentoResponsavel.update({
      where: { id: pagamento.id },
      data: {
        status: payment.status === "rejected" ? "RECUSADO" : "CANCELADO",
        gatewayPagamentoId: String(payment.id),
      },
    });
  }
  return true;
}
