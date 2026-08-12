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

export type PublicoPlano = "MOTORISTA" | "RESPONSAVEL";

export type PlanoDefinicao = {
  id: string;
  codigo: string;
  label: string;
  publico: PublicoPlano;
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
 * Valor da MENSALIDADE FIXA do MOTORISTA pela plataforma — só varia pelos
 * anos adicionais (planos anuais que permitem contratar mais de 1 ano de uma
 * vez). Não inclui a cobrança por aluno: essa é separada, gerada aluno a
 * aluno a cada 30 dias de vínculo ativo (ver `src/lib/subscription/
 * cobranca-aluno.ts`), porque cada aluno tem sua própria data de corte — não
 * dá pra somar num valor único fechado no momento da assinatura. Os campos
 * `alunosGratis`/`valorAlunosExcedentes` aqui são só informativos (pra
 * mostrar no preview do plano quantos alunos entram grátis e quanto custa
 * cada excedente) — o valor em si dessa cobrança NÃO entra em `valorTotal`.
 */
export function calcularValorAssinaturaMotorista(params: {
  plano: Pick<PlanoDefinicao, "valorBase" | "permiteAnosAdicionais" | "alunosGratis" | "valorPorAlunoExcedente">;
  anosAdicionais?: number;
}): ResumoValorAssinatura {
  const { plano } = params;
  const anosAdicionais = plano.permiteAnosAdicionais ? Math.max(0, Math.floor(params.anosAdicionais ?? 0)) : 0;
  const valorAnosAdicionais = anosAdicionais * plano.valorBase;
  const valorTotal = plano.valorBase + valorAnosAdicionais;

  return {
    valorPlano: plano.valorBase,
    alunosGratis: plano.alunosGratis,
    alunosContratados: 0,
    alunosCobrados: 0,
    valorAlunosExcedentes: plano.valorPorAlunoExcedente,
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

/**
 * Teste grátis em nível de conta (motorista/responsável) — ver
 * `Motorista.testeExpiraEm`/`Responsavel.testeExpiraEm`. Começa
 * automaticamente no cadastro, não depende de escolher um plano.
 */
export function contaEmTeste(testeExpiraEm: Date, agora: Date = new Date()): boolean {
  return testeExpiraEm.getTime() > agora.getTime();
}

export function diasRestantesConta(testeExpiraEm: Date, agora: Date = new Date()): number {
  const ms = testeExpiraEm.getTime() - agora.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function formatarBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
