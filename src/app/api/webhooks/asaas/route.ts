import { NextRequest, NextResponse } from "next/server";

import { confirmarPagamentoAsaas } from "@/lib/subscription/service";
import { verificarWebhookAsaas } from "@/lib/payment/asaas";

/**
 * A Asaas chama essa rota sempre que uma cobrança muda de status. Igual ao
 * antigo webhook do Mercado Pago: o corpo da notificação NUNCA é a fonte de
 * verdade — só usamos ele pra saber "qual cobrança consultar", e a ativação
 * real da assinatura depende de `confirmarPagamentoAsaas` revalidar essa
 * cobrança direto na API da Asaas com nossa própria chave.
 *
 * Diferente do Mercado Pago, aqui a validação do header
 * (`asaas-access-token`) É obrigatória, não best-effort — é o que garante
 * que a notificação veio do webhook específico do Moove e não de outro
 * projeto cadastrado na mesma conta Asaas do usuário (cada webhook na Asaas
 * tem seu próprio `authToken`; até 10 webhooks por conta).
 *
 * Sempre respondemos 2xx (mesmo em notificações irrelevantes) pra evitar
 * reentrega desnecessária — a Asaas usa entrega "at least once" e pode
 * reenviar o mesmo evento mais de uma vez (por isso a idempotência em
 * `confirmarPagamentoAsaas`, que já checa `pagamento.status === "APROVADO"`
 * antes de reprocessar).
 */
export async function POST(request: NextRequest) {
  const tokenRecebido = request.headers.get("asaas-access-token");

  if (!verificarWebhookAsaas(tokenRecebido)) {
    console.warn("[webhook asaas] token inválido ou ausente — notificação rejeitada.");
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const evento = body?.event as string | undefined;
  const paymentId = body?.payment?.id as string | undefined;

  const eventosDeConfirmacao = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS"];

  if (evento && eventosDeConfirmacao.includes(evento) && paymentId) {
    try {
      // Único tipo de cobrança pela plataforma hoje: a mensalidade fixa do
      // motorista (a cobrança por aluno é PIX direto entre motorista e
      // responsável, fora da Asaas — ver CobrancaAluno).
      await confirmarPagamentoAsaas(paymentId);
    } catch (err) {
      console.error("[webhook asaas] falha ao confirmar pagamento", err);
      return NextResponse.json({ error: "Falha ao processar notificação." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
