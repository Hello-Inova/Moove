// Definição dos planos + cálculo de preço. Módulo "puro" (sem acesso a
// banco/segredos) de propósito: é importado tanto por Server Components/API
// routes quanto por Client Components (o formulário de assinatura usa a
// mesma fórmula para mostrar o preview do valor/desconto em tempo real).

export type TipoPlano = "BASIC" | "PRO" | "MAX";
export type CicloCobranca = "MENSAL" | "SEMESTRAL" | "ANUAL";

export type PlanoDefinicao = {
  tipo: TipoPlano;
  label: string;
  ciclo: CicloCobranca;
  cicloLabel: string;
  valorBase: number;
  alunosGratis: number;
  valorPorAlunoExcedente: number;
  recursos: string[];
  permiteAnosAdicionais: boolean;
  destaque?: string;
};

export const TESTE_DIAS = 7;

export const PLANOS: Record<TipoPlano, PlanoDefinicao> = {
  BASIC: {
    tipo: "BASIC",
    label: "Basic",
    ciclo: "MENSAL",
    cicloLabel: "Cobrança mensal",
    valorBase: 33.0,
    alunosGratis: 0,
    valorPorAlunoExcedente: 1.0,
    recursos: ["Cobrança mensal", `${TESTE_DIAS} dias de teste`, "+ R$ 1,00 por aluno"],
    permiteAnosAdicionais: false,
  },
  PRO: {
    tipo: "PRO",
    label: "Pró",
    ciclo: "SEMESTRAL",
    cicloLabel: "Cobrança semestral",
    valorBase: 178.2,
    alunosGratis: 5,
    valorPorAlunoExcedente: 1.0,
    recursos: [
      "Cobrança semestral",
      `${TESTE_DIAS} dias de teste`,
      "10% de economia vs. Basic",
      "5 alunos grátis",
      "+ R$ 1,00 por aluno excedente",
    ],
    permiteAnosAdicionais: false,
    destaque: "Mais popular",
  },
  MAX: {
    tipo: "MAX",
    label: "Max",
    ciclo: "ANUAL",
    cicloLabel: "Cobrança anual",
    valorBase: 356.4,
    alunosGratis: 10,
    valorPorAlunoExcedente: 1.0,
    recursos: [
      "Cobrança anual",
      `${TESTE_DIAS} dias de teste`,
      "Acesso ao módulo de gestão de alunos",
      "10 alunos grátis",
      "10% de economia vs. Basic",
      "+ R$ 1,00 por aluno excedente",
    ],
    permiteAnosAdicionais: true,
  },
};

export type ResumoValorAssinatura = {
  valorPlano: number;
  alunosGratis: number;
  alunosContratados: number;
  alunosCobrados: number;
  valorAlunosExcedentes: number;
  anosAdicionais: number;
  valorAnosAdicionais: number;
  valorTotal: number;
};

/**
 * Calcula o valor a cobrar. Sempre recalculado no servidor a partir dos
 * parâmetros brutos antes de criar a cobrança — nunca confiamos num total
 * vindo do cliente.
 */
export function calcularValorAssinatura(params: {
  tipoPlano: TipoPlano;
  qtdAlunos: number;
  anosAdicionais?: number;
}): ResumoValorAssinatura {
  const plano = PLANOS[params.tipoPlano];
  const alunosContratados = Math.max(0, Math.floor(params.qtdAlunos));
  const alunosCobrados = Math.max(0, alunosContratados - plano.alunosGratis);
  const valorAlunosExcedentes = alunosCobrados * plano.valorPorAlunoExcedente;

  const anosAdicionais = plano.permiteAnosAdicionais ? Math.max(0, Math.floor(params.anosAdicionais ?? 0)) : 0;
  const valorAnosAdicionais = anosAdicionais * plano.valorBase;

  const valorTotal = plano.valorBase + valorAlunosExcedentes + valorAnosAdicionais;

  return {
    valorPlano: plano.valorBase,
    alunosGratis: plano.alunosGratis,
    alunosContratados,
    alunosCobrados,
    valorAlunosExcedentes,
    anosAdicionais,
    valorAnosAdicionais,
    valorTotal,
  };
}

/** Data de expiração do ciclo pago a partir de `from` (default: agora). */
export function calcularExpiraEmAssinatura(
  cicloCobranca: CicloCobranca,
  anosAdicionais: number,
  from: Date = new Date()
): Date {
  const d = new Date(from);
  if (cicloCobranca === "MENSAL") {
    d.setUTCMonth(d.getUTCMonth() + 1);
  } else if (cicloCobranca === "SEMESTRAL") {
    d.setUTCMonth(d.getUTCMonth() + 6);
  } else {
    d.setUTCFullYear(d.getUTCFullYear() + 1 + anosAdicionais);
  }
  return d;
}

export function calcularTesteExpiraEm(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + TESTE_DIAS);
  return d;
}

export function formatarBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
