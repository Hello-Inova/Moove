import { NextRequest, NextResponse } from "next/server";

import { confirmarPagamentoMercadoPago } from "@/lib/subscription/service";
import { verificarAssinaturaWebhook } from "@/lib/payment/mercadopago";

/**
 * O Mercado Pago chama essa rota sempre que um pagamento muda de status.
 * O corpo/query da notificação NUNCA é a fonte de verdade — só usamos ela
 * pra saber "qual pagamento consultar", e a ativação real da assinatura
 * depende de `confirmarPagamentoMercadoPago` revalidar esse pagamento
 * direto na API do Mercado Pago com nosso próprio access token.
 *
 * Sempre respondemos 200 (mesmo em notificações irrelevantes) pra evitar
 * que o Mercado Pago fique retentando notificações que não dizem respeito
 * a um pagamento — só erros inesperados retornam 500 pra pedir um retry.
 */
export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataIdFromQuery = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  const body = await request.json().catch(() => null);
  const dataId = body?.data?.id ? String(body.data.id) : dataIdFromQuery;

  // Validação best-effort da assinatura (ver comentário em
  // verificarAssinaturaWebhook) — não bloqueia o processamento, só registra.
  const assinaturaValida = verificarAssinaturaWebhook({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!assinaturaValida) {
    console.warn("[webhook mercadopago] assinatura não confirmada — seguindo com revalidação via API mesmo assim.");
  }

  if ((topic === "payment" || body?.type === "payment") && dataId) {
    try {
      // Só existe um tipo de pagamento pela plataforma hoje: a mensalidade
      // fixa do motorista (a cobrança por aluno é PIX direto entre motorista
      // e responsável, fora do Mercado Pago — ver CobrancaAluno).
      await confirmarPagamentoMercadoPago(dataId);
    } catch (err) {
      console.error("[webhook mercadopago] falha ao confirmar pagamento", err);
      return NextResponse.json({ error: "Falha ao processar notificação." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
