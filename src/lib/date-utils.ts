// Utilitários de data puros (sem Prisma/`server-only`) — extraído de
// `src/lib/subscription/cobranca-aluno.ts` pra poder ser testado em
// unidade isoladamente. Reexportado de lá pra não quebrar quem já importa
// `adicionarDias` daquele módulo.

/** Retorna uma NOVA data (não muta `data`) `dias` à frente (ou atrás, se
 * negativo). Usado pro cálculo de ciclos de 30 em 30 dias das cobranças por
 * aluno e das mensalidades de transporte. */
export function adicionarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}
