import "server-only";

import { prisma } from "@/lib/prisma";
import { createAsaasCheckout } from "@/lib/payment/asaas";
import { confirmarPagamentoAsaas } from "@/lib/subscription/service";
import {
  SemCobrancaPendenteError,
  ValorAbaixoDoMinimoError,
  VALOR_MINIMO_ASAAS,
  somarPendentes,
  atingiuMinimoAsaas,
} from "@/lib/subscription/cobranca-aluno-pagamento-regras";

/** Reexportados de `@/lib/subscription/cobranca-aluno-pagamento-regras`
 * (movidos pra lá pra poderem ser testados em unidade sem depender do
 * Prisma Client/`server-only`) — mantidos aqui pra não quebrar quem já
 * importa deste módulo. */
export { SemCobrancaPendenteError, ValorAbaixoDoMinimoError, VALOR_MINIMO_ASAAS };

/**
 * Gera o link de pagamento Asaas cobrindo TODAS as cobranças por aluno
 * ainda PENDENTES desse motorista de uma vez — nunca uma por uma. Isso
 * existe porque a Asaas recusa cobrança abaixo de R$5,00 e o valor por
 * aluno excedente dos planos costuma ser bem menor (ex.: R$1,20): agrupando
 * várias cobranças (de alunos e/ou ciclos diferentes) no mesmo Pagamento, o
 * total chega no mínimo exigido sem precisar mudar o valor do plano.
 *
 * Sempre cria uma tentativa nova (mesmo padrão simples já usado em
 * `criarAssinaturaComCheckout` — sem reaproveitar link de tentativa
 * anterior); o botão que chama isso já trava contra duplo clique.
 */
export async function criarCheckoutCobrancasAlunoPendentes(motoristaId: string): Promise<{ checkoutUrl: string }> {
  const pendentes = await prisma.cobrancaAluno.findMany({
    where: { motoristaId, status: "PENDENTE" },
    orderBy: { criadoEm: "asc" },
  });

  if (pendentes.length === 0) {
    throw new SemCobrancaPendenteError("Não há cobrança pendente pra pagar.");
  }

  const total = somarPendentes(pendentes);
  if (!atingiuMinimoAsaas(total)) {
    throw new ValorAbaixoDoMinimoError(total);
  }

  const motorista = await prisma.motorista.findUniqueOrThrow({ where: { id: motoristaId } });

  const pagamento = await prisma.pagamento.create({
    data: { valor: total, gateway: "asaas" },
  });

  await prisma.cobrancaAluno.updateMany({
    where: { id: { in: pendentes.map((c) => c.id) } },
    data: { pagamentoId: pagamento.id },
  });

  const checkout = await createAsaasCheckout({
    titulo:
      pendentes.length === 1
        ? "Moove — Cobrança por aluno excedente"
        : `Moove — Cobrança por aluno excedente (${pendentes.length} cobranças)`,
    valor: total,
    externalReference: pagamento.id,
    payerEmail: motorista.email,
    payerNome: motorista.nome,
    payerCpf: motorista.cpf,
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
 * em /api/motorista/assinatura/sincronizar) — chamada pela tela
 * /motorista/vinculos sempre que ela abre, pra revalidar direto na Asaas
 * qualquer Pagamento de cobrança-por-aluno ainda PENDENTE desse motorista,
 * em vez de depender só da notificação assíncrona chegar. Devolve quantas
 * cobranças foram confirmadas nesta chamada.
 */
export async function sincronizarCobrancasAlunoPendentes(motoristaId: string): Promise<number> {
  const pagamentosPendentes = await prisma.pagamento.findMany({
    where: {
      status: "PENDENTE",
      gatewayPreferenceId: { not: null },
      cobrancasAluno: { some: { motoristaId, status: "PENDENTE" } },
    },
    select: { id: true, gatewayPreferenceId: true },
  });

  let atualizados = 0;
  for (const p of pagamentosPendentes) {
    if (!p.gatewayPreferenceId) continue;
    await confirmarPagamentoAsaas(p.gatewayPreferenceId);
    const atual = await prisma.pagamento.findUnique({ where: { id: p.id }, select: { status: true } });
    if (atual?.status === "APROVADO") atualizados++;
  }
  return atualizados;
}
