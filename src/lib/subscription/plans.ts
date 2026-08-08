// Moove — cálculo de preço de assinatura. Módulo "puro" (sem acesso a
// banco/segredos) de propósito: é importado tanto por Server Components/API
// routes quanto por Client Components (o formulário de assinatura usa a
// mesma fórmula para mostrar o preview do valor/desconto em tempo real).
//
// O catálogo de planos em si (Basic/Pró/Max e quaisquer outros que o admin
// criar) NÃO mora mais aqui — vive na tabela `planos_assinatura` e é lido
// via `src/lib/subscription/planos-service.ts` (server-only). Este arquivo
// só define o formato de um plano e a matemática pura em cima dele, para
// que o mesmo cálculo funcione tanto no servidor (com o plano vindo do
// banco) quanto no cliente (com o plano recebido por props/API).

export type CicloCobranca = "MENSAL" | "SEMESTRAL" | "ANUAL";

export type PlanoDefinicao = {
  id: string;
  codigo: string;
  label: string;
  ciclo: CicloCobranca;
  cicloLabel: string;
  valorBase: number;
  alunosGratis: number;
  valorPorAlunoExcedente: number;
  recursos: string[];
  permiteAnosAdicionais: boolean;
  destaque?: string | null;
  ativo: boolean;
  ordem: number;
};

export const TESTE_DIAS = 7;

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
 * Calcula o valor a cobrar. Sempre recalculado no servidor a partir do plano
 * lido do banco (não confiamos num total vindo do cliente).
 */
export function calcularValorAssinatura(params: {
  plano: Pick<PlanoDefinicao, "valorBase" | "alunosGratis" | "valorPorAlunoExcedente" | "permiteAnosAdicionais">;
  qtdAlunos: number;
  anosAdicionais?: number;
}): ResumoValorAssinatura {
  const { plano } = params;
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
