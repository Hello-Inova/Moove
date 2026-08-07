// Sem `import "server-only"` de propósito: este módulo também é importado
// pelo job standalone (scripts/fechamento-mensal.ts), executado fora do
// bundler do Next.js via tsx/node.

export function getPlanoDefaults() {
  const alunosIncluidosGratis = Number(process.env.BILLING_ALUNOS_INCLUIDOS_GRATIS ?? 5);
  const valorPorAlunoExcedente = process.env.BILLING_VALOR_POR_ALUNO_EXCEDENTE ?? "6.00";

  return { alunosIncluidosGratis, valorPorAlunoExcedente };
}
