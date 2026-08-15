// Regras puras do batching de cobrança-por-aluno via Asaas — extraído de
// `cobranca-aluno-pagamento.ts` (que importa Prisma/`server-only`) pra um
// módulo sem dependências externas, testável em unidade. Reexportado de lá
// pra não quebrar quem já importa daquele módulo.

export class SemCobrancaPendenteError extends Error {}

/** A Asaas recusa cobrança abaixo desse valor (mesmo mínimo pra Pix, boleto
 * e cartão nesse tipo de checkout — ver createAsaasCheckout). */
export const VALOR_MINIMO_ASAAS = 5;

export class ValorAbaixoDoMinimoError extends Error {
  constructor(
    public totalPendente: number,
    public minimo: number = VALOR_MINIMO_ASAAS
  ) {
    super(
      `Suas cobranças pendentes somam R$ ${totalPendente.toFixed(2)} — a Asaas só aceita pagamentos a partir de R$ ${minimo.toFixed(2)}. Assim que o total atingir esse valor, o pagamento fica disponível.`
    );
  }
}

/** Soma o valor de uma lista de cobranças pendentes (`c.valor` pode vir
 * como `Decimal` do Prisma ou `number` — por isso `Number(...)` em vez de
 * assumir o tipo). Função pura, sem acesso a banco. */
export function somarPendentes(cobrancas: { valor: number | string | { toString(): string } }[]): number {
  return cobrancas.reduce((soma, c) => soma + Number(c.valor), 0);
}

/** Decide se um total de cobranças pendentes já pode virar checkout Asaas
 * (bateu o mínimo) — extraído pra função pura testável isoladamente da
 * lógica de banco/API em `criarCheckoutCobrancasAlunoPendentes`. */
export function atingiuMinimoAsaas(total: number, minimo: number = VALOR_MINIMO_ASAAS): boolean {
  return total >= minimo;
}
