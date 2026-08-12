import "server-only";
import { createHmac } from "crypto";

const MP_API_BASE = "https://api.mercadopago.com";

export class MercadoPagoNotConfiguredError extends Error {}
export class MercadoPagoApiError extends Error {}

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new MercadoPagoNotConfiguredError(
      "Pagamento ainda não está configurado neste ambiente (MERCADOPAGO_ACCESS_TOKEN)."
    );
  }
  return token;
}

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL não configurada — necessária para montar as URLs de retorno/webhook do Mercado Pago."
    );
  }
  return url.replace(/\/$/, "");
}

export type MercadoPagoPreference = { id: string; initPoint: string };

/**
 * Cria uma "preference" do Checkout Pro — uma página de pagamento hospedada
 * pelo Mercado Pago (cartão, Pix, boleto já incluídos, sem formulário
 * próprio de cartão no nosso servidor). `externalReference` é o id do
 * nosso `Pagamento` — é como cruzamos o webhook de volta com nosso registro.
 */
export async function createMercadoPagoPreference(params: {
  titulo: string;
  valor: number;
  externalReference: string;
  payerEmail: string;
  /** Caminho (sem domínio) para onde o Mercado Pago redireciona depois do
   * pagamento — por padrão a vitrine de planos do motorista (único fluxo de
   * pagamento pela plataforma; o responsável não paga nada). */
  backUrlPath?: string;
}): Promise<MercadoPagoPreference> {
  const appUrl = getAppUrl();
  const backUrlPath = params.backUrlPath ?? "/motorista/planos";
  // `auto_return` exige back_urls públicas em https — em dev local
  // (http://localhost) o Mercado Pago recusa a preference inteira com um
  // erro (mal explicado: "back_url.success must be defined"). Só pedimos o
  // retorno automático quando a URL é mesmo pública.
  const podeAutoReturn = appUrl.startsWith("https://");

  const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: params.titulo,
          quantity: 1,
          unit_price: Number(params.valor.toFixed(2)),
          currency_id: "BRL",
        },
      ],
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      back_urls: {
        success: `${appUrl}${backUrlPath}?pagamento=sucesso`,
        pending: `${appUrl}${backUrlPath}?pagamento=pendente`,
        failure: `${appUrl}${backUrlPath}?pagamento=falha`,
      },
      ...(podeAutoReturn ? { auto_return: "approved" } : {}),
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[mercadopago] Falha ao criar preference (HTTP ${response.status}): ${body}`);
    throw new MercadoPagoApiError(`Falha ao criar checkout no Mercado Pago (HTTP ${response.status}): ${body}`);
  }

  const data = await response.json();
  return { id: data.id, initPoint: data.init_point };
}

export type MercadoPagoPayment = {
  id: number;
  status: "approved" | "pending" | "in_process" | "rejected" | "cancelled" | "refunded" | string;
  transactionAmount: number;
  externalReference: string | null;
};

/**
 * Ponto de segurança central da integração: o webhook do Mercado Pago só
 * avisa "um pagamento mudou de status" — nunca confiamos no corpo dele.
 * Esta função sempre busca o pagamento de volta na API oficial usando
 * nosso próprio access token antes de qualquer ativação de assinatura.
 */
export async function getMercadoPagoPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const response = await fetch(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[mercadopago] Falha ao consultar pagamento (HTTP ${response.status}): ${body}`);
    throw new MercadoPagoApiError(`Falha ao consultar pagamento no Mercado Pago (HTTP ${response.status}): ${body}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    transactionAmount: data.transaction_amount,
    externalReference: data.external_reference ?? null,
  };
}

/**
 * Validação best-effort da assinatura do webhook (header `x-signature`),
 * conforme documentado pelo Mercado Pago. Isso é uma camada extra — a
 * proteção real é `getMercadoPagoPayment`, que sempre revalida o pagamento
 * na API oficial antes de ativar qualquer assinatura. Por isso, se o
 * segredo não estiver configurado ou a validação falhar, apenas registramos
 * um aviso em vez de rejeitar a notificação: perder um webhook legítimo
 * pararia a ativação da assinatura do motorista sem necessidade.
 */
export function verificarAssinaturaWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !params.xSignature || !params.xRequestId || !params.dataId) return false;

  const parts = Object.fromEntries(
    params.xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    })
  );
  const ts = parts["ts"];
  const hash = parts["v1"];
  if (!ts || !hash) return false;

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.xRequestId};ts:${ts};`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");

  return computed === hash;
}
