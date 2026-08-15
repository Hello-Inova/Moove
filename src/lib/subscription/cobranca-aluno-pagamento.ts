import "server-only";

import { prisma } from "@/lib/prisma";
import { createAsaasCheckout } from "@/lib/payment/asaas";
import { confirmarPagamentoAsaas } from "@/lib/subscription/service";

export class CobrancaAlunoNaoEncontradaError extends Error {}
export class CobrancaAlunoJaFinalizadaError extends Error {}

/**
 * Gera (ou reaproveita) o link de pagamento Asaas de uma CobrancaAluno
 * específica — mesma ideia do checkout de assinatura (ver
 * `criarAssinaturaComCheckout`), só que aqui a cobrança já existe (criada
 * pelo cron diário, ver cobranca-aluno.ts) e só falta o motorista pagar.
 *
 * Se já existir um Pagamento PENDENTE com link ativo pra essa mesma
 * cobrança, devolve o mesmo link em vez de criar outra cobrança na Asaas —
 * evita duplicar cobrança pro mesmo débito a cada clique em "Pagar".
 */
export async function criarCheckoutCobrancaAluno(params: {
  cobrancaAlunoId: string;
  motoristaId: string;
}): Promise<{ checkoutUrl: string }> {
  const cobranca = await prisma.cobrancaAluno.findUnique({
    where: { id: params.cobrancaAlunoId },
    include: { vinculo: { include: { aluno: true } }, motorista: true },
  });

  if (!cobranca || cobranca.motoristaId !== params.motoristaId) {
    throw new CobrancaAlunoNaoEncontradaError("Cobrança não encontrada.");
  }
  if (cobranca.status !== "PENDENTE") {
    throw new CobrancaAlunoJaFinalizadaError(
      cobranca.status === "PAGO" ? "Esta cobrança já foi paga." : "Esta cobrança foi cancelada."
    );
  }

  const pagamentoExistente = await prisma.pagamento.findFirst({
    where: { cobrancaAlunoId: cobranca.id, status: "PENDENTE" },
    orderBy: { criadoEm: "desc" },
  });
  if (pagamentoExistente?.checkoutUrl) {
    return { checkoutUrl: pagamentoExistente.checkoutUrl };
  }

  const pagamento =
    pagamentoExistente ??
    (await prisma.pagamento.create({
      data: { cobrancaAlunoId: cobranca.id, valor: cobranca.valor, gateway: "asaas" },
    }));

  const checkout = await createAsaasCheckout({
    titulo: `Moove — Cobrança por aluno (${cobranca.vinculo.aluno.nome})`,
    valor: Number(cobranca.valor),
    externalReference: pagamento.id,
    payerEmail: cobranca.motorista.email,
    payerNome: cobranca.motorista.nome,
    payerCpf: cobranca.motorista.cpf,
    backUrlPath: "/motorista/vinculos",
  });

  await prisma.pagamento.update({
    where: { id: pagamento.id },
    data: { gatewayPreferenceId: checkout.id, checkoutUrl: checkout.initPoint },
  });

  return { checkoutUrl: checkout.initPoint };
}

/**
 * Rede de segurança contra falha do webhook da Asaas (mesmo padrão já usado
 * em `/api/motorista/assinatura/sincronizar`): revalida direto na API deles
 * qualquer Pagamento de cobrança-por-aluno ainda PENDENTE desse motorista,
 * em vez de depender só da notificação assíncrona chegar. Devolve quantas
 * cobranças foram confirmadas nesta chamada.
 */
export async function sincronizarCobrancasAlunoPendentes(motoristaId: string): Promise<number> {
  const pendentes = await prisma.pagamento.findMany({
    where: { status: "PENDENTE", cobrancaAluno: { motoristaId }, gatewayPreferenceId: { not: null } },
    select: { id: true, gatewayPreferenceId: true },
  });

  let atualizados = 0;
  for (const p of pendentes) {
    if (!p.gatewayPreferenceId) continue;
    await confirmarPagamentoAsaas(p.gatewayPreferenceId);
    const atual = await prisma.pagamento.findUnique({ where: { id: p.id }, select: { status: true } });
    if (atual?.status === "APROVADO") atualizados++;
  }
  return atualizados;
}
