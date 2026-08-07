// Sem `import "server-only"` de propósito: este módulo também é importado
// pelo job standalone (scripts/fechamento-mensal.ts), executado fora do
// bundler do Next.js via tsx/node.

import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/billing/payment-gateway";
import { getPlanoDefaults } from "@/lib/billing/config";

/** Formata uma data como referência de mês "YYYY-MM" (UTC). */
export function formatarReferenciaMes(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Referência do mês anterior à data informada — usada pelo fechamento mensal. */
export function referenciaMesAnterior(from: Date = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - 1, 1));
  return formatarReferenciaMes(d);
}

export type ResultadoFechamento = {
  motoristaId: string;
  referenciaMes: string;
  qtdAlunosVinculados: number;
  qtdAlunosCobrados: number;
  valorTotal: string;
  cobrancaId: string;
  jaExistia: boolean;
};

/**
 * Calcula e persiste o fechamento mensal de um motorista (idempotente: uma
 * segunda chamada para o mesmo mês retorna a cobrança já existente em vez de
 * duplicar). Regra de negócio: grátis até `alunosIncluidosGratis` vínculos
 * ativos; a partir do próximo, cobrança por aluno/mês pelo valor configurado
 * no Plano do motorista.
 *
 * Observação sobre a contagem: usamos os vínculos ATIVOS no momento em que o
 * fechamento roda como proxy de "alunos vinculados no mês de referência".
 * Um sistema com requisito de cobrança pro-rata por dias vinculados no mês
 * precisaria de um histórico de transições de status — fora do escopo atual.
 */
export async function gerarCobrancaMensal(
  motoristaId: string,
  referenciaMes: string
): Promise<ResultadoFechamento> {
  const existente = await prisma.cobranca.findUnique({
    where: { motoristaId_referenciaMes: { motoristaId, referenciaMes } },
  });
  if (existente) {
    return {
      motoristaId,
      referenciaMes,
      qtdAlunosVinculados: existente.qtdAlunosVinculados,
      qtdAlunosCobrados: existente.qtdAlunosCobrados,
      valorTotal: existente.valorTotal.toString(),
      cobrancaId: existente.id,
      jaExistia: true,
    };
  }

  const plano = await prisma.plano.upsert({
    where: { motoristaId },
    create: { motoristaId, ...getPlanoDefaults() },
    update: {},
  });

  const vinculosAtivos = await prisma.vinculo.findMany({
    where: { motoristaId, status: "ATIVO" },
    orderBy: { criadoEm: "asc" },
  });

  const qtdAlunosVinculados = vinculosAtivos.length;
  const gratis = plano.alunosIncluidosGratis;
  const vinculosCobrados = vinculosAtivos.slice(gratis);
  const qtdAlunosCobrados = vinculosCobrados.length;
  const valorTotal = plano.valorPorAlunoExcedente.mul(qtdAlunosCobrados);

  const cobranca = await prisma.cobranca.create({
    data: {
      motoristaId,
      referenciaMes,
      qtdAlunosVinculados,
      qtdAlunosCobrados,
      valorTotal,
      status: qtdAlunosCobrados > 0 ? "PENDENTE" : "PAGO", // nada a cobrar = já "quitado"
      itens: {
        create: vinculosCobrados.map((v) => ({ vinculoId: v.id })),
      },
    },
  });

  if (cobranca.status === "PENDENTE") {
    const gateway = getPaymentGateway();
    await gateway.charge(cobranca);
  }

  return {
    motoristaId,
    referenciaMes,
    qtdAlunosVinculados,
    qtdAlunosCobrados,
    valorTotal: valorTotal.toString(),
    cobrancaId: cobranca.id,
    jaExistia: false,
  };
}

export type ResumoFechamentoMensal = {
  referenciaMes: string;
  motoristasProcessados: number;
  cobrancasGeradas: number;
  cobrancasJaExistentes: number;
  falhas: Array<{ motoristaId: string; erro: string }>;
};

/** Roda o fechamento mensal para todos os motoristas com conta ativa. */
export async function executarFechamentoMensal(
  referenciaMes: string = referenciaMesAnterior()
): Promise<ResumoFechamentoMensal> {
  const motoristas = await prisma.motorista.findMany({
    where: { statusConta: "ATIVA" },
    select: { id: true },
  });

  const resumo: ResumoFechamentoMensal = {
    referenciaMes,
    motoristasProcessados: 0,
    cobrancasGeradas: 0,
    cobrancasJaExistentes: 0,
    falhas: [],
  };

  for (const { id } of motoristas) {
    try {
      const resultado = await gerarCobrancaMensal(id, referenciaMes);
      resumo.motoristasProcessados += 1;
      if (resultado.jaExistia) resumo.cobrancasJaExistentes += 1;
      else resumo.cobrancasGeradas += 1;
    } catch (err) {
      resumo.falhas.push({
        motoristaId: id,
        erro: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return resumo;
}
