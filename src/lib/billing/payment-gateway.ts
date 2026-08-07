// Sem `import "server-only"` de propósito: este módulo também é importado
// pelo job standalone (scripts/fechamento-mensal.ts), executado fora do
// bundler do Next.js via tsx/node.

import type { Cobranca } from "@prisma/client";

/**
 * Contrato para integração futura com um gateway de pagamento real (ex:
 * Stripe, Pagar.me, Asaas). Nenhuma integração está conectada ainda — a
 * cobrança mensal é gerada e persistida com status PENDENTE independente do
 * gateway, para que o fechamento financeiro não fique bloqueado por essa
 * integração.
 */
export interface PaymentGateway {
  /**
   * Deve iniciar a cobrança externa (ex: criar invoice/cobrança no gateway)
   * e retornar um identificador externo para reconciliação futura.
   */
  charge(cobranca: Cobranca): Promise<{ externalId: string | null }>;
}

/**
 * Implementação stub: não realiza nenhuma chamada externa. Mantém a cobrança
 * como PENDENTE até que um gateway real seja integrado e o webhook de
 * confirmação de pagamento atualize o status para PAGO.
 */
export class NullPaymentGateway implements PaymentGateway {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura fixada pela interface PaymentGateway
  async charge(cobranca: Cobranca): Promise<{ externalId: string | null }> {
    return { externalId: null };
  }
}

export function getPaymentGateway(): PaymentGateway {
  return new NullPaymentGateway();
}
