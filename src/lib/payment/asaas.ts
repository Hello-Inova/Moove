import "server-only";
import { timingSafeEqual } from "crypto";

// Base da API muda entre sandbox e produção — a Asaas exige que a chave usada
// bata com o ambiente da URL (chave de produção numa URL de sandbox dá erro
// de autenticação, e vice-versa). Controlado por ASAAS_SANDBOX ("true"/"false"),
// nunca pelo formato da chave (diferente do Mercado Pago, aqui não dá pra
// inferir com segurança só pelo prefixo).
const ASAAS_API_BASE = process.env.ASAAS_SANDBOX === "true" ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3";

export class AsaasNotConfiguredError extends Error {}
export class AsaasApiError extends Error {}
export class AsaasPayerSemCpfError extends Error {}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) {
    throw new AsaasNotConfiguredError("Pagamento ainda não está configurado neste ambiente (ASAAS_API_KEY).");
  }
  return key;
}

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL não configurada — necessária para montar a URL de retorno após o pagamento."
    );
  }
  return url.replace(/\/$/, "");
}

/**
 * Wrapper único pra todas as chamadas à API da Asaas — centraliza a
 * autenticação (header `access_token`, não é `Authorization: Bearer` como no
 * Mercado Pago) e a base URL sandbox/produção.
 */
async function asaasFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${ASAAS_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Moove/1.0",
      access_token: getApiKey(),
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Acha um cliente Asaas já cadastrado pelo CPF (evita duplicar o mesmo
 * motorista a cada nova cobrança) ou cria um novo. CPF é obrigatório aqui —
 * a Asaas não aceita cadastrar cliente sem `cpfCnpj`.
 */
async function findOrCreateAsaasCustomer(params: { nome: string; cpf: string; email: string }): Promise<string> {
  const cpfDigitos = params.cpf.replace(/\D/g, "");

  const buscaResponse = await asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(cpfDigitos)}`);
  if (buscaResponse.ok) {
    const busca = await buscaResponse.json();
    const existente = busca?.data?.[0]?.id;
    if (existente) return existente;
  }

  const criaResponse = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.nome,
      cpfCnpj: cpfDigitos,
      email: params.email,
    }),
  });

  if (!criaResponse.ok) {
    const body = await criaResponse.text().catch(() => "");
    console.error(`[asaas] Falha ao criar cliente (HTTP ${criaResponse.status}): ${body}`);
    throw new AsaasApiError(`Falha ao cadastrar pagador na Asaas (HTTP ${criaResponse.status}): ${body}`);
  }

  const criado = await criaResponse.json();
  return criado.id;
}

export type AsaasCheckout = { id: string; initPoint: string };

/**
 * Equivalente Asaas do antigo `createMercadoPagoPreference`: cria (ou
 * reaproveita) o cliente, cria a cobrança com `billingType: "UNDEFINED"`
 * (deixa o pagador escolher Pix ou cartão na própria fatura hospedada pela
 * Asaas) e devolve a URL da fatura (`invoiceUrl`) — o equivalente ao
 * `init_point` do Mercado Pago.
 */
export async function createAsaasCheckout(params: {
  titulo: string;
  valor: number;
  externalReference: string;
  payerEmail: string;
  payerNome: string;
  /** CPF do pagador (só dígitos ou formatado) — obrigatório: a Asaas não
   * cadastra cliente nem gera cobrança sem CPF. */
  payerCpf?: string | null;
  backUrlPath?: string;
}): Promise<AsaasCheckout> {
  if (!params.payerCpf) {
    throw new AsaasPayerSemCpfError(
      "CPF do motorista não cadastrado — obrigatório para gerar a cobrança na Asaas."
    );
  }

  const appUrl = getAppUrl();
  const backUrlPath = params.backUrlPath ?? "/motorista/planos";

  const customerId = await findOrCreateAsaasCustomer({
    nome: params.payerNome,
    cpf: params.payerCpf,
    email: params.payerEmail,
  });

  // Cobrança "pra hoje" — não é uma fatura futura, é o equivalente a um
  // checkout imediato (mesma ideia do Checkout Pro do Mercado Pago).
  const hoje = new Date().toISOString().slice(0, 10);

  const response = await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: "UNDEFINED",
      value: Number(params.valor.toFixed(2)),
      dueDate: hoje,
      description: params.titulo,
      externalReference: params.externalReference,
      callback: {
        successUrl: `${appUrl}${backUrlPath}?pagamento=sucesso`,
        autoRedirect: true,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[asaas] Falha ao criar cobrança (HTTP ${response.status}): ${body}`);
    throw new AsaasApiError(`Falha ao criar checkout na Asaas (HTTP ${response.status}): ${body}`);
  }

  const data = await response.json();
  return { id: data.id, initPoint: data.invoiceUrl };
}

export type AsaasPayment = {
  id: string;
  // Status possíveis: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED,
  // RECEIVED_IN_CASH, REFUND_REQUESTED, CHARGEBACK_REQUESTED, etc.
  status: string;
  value: number;
  externalReference: string | null;
};

/**
 * Mesmo espírito do `getMercadoPagoPayment`: ponto de segurança central —
 * nunca confiamos no corpo do webhook, sempre revalidamos a cobrança direto
 * na API oficial da Asaas com nossa própria chave antes de ativar qualquer
 * assinatura.
 */
export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  const response = await asaasFetch(`/payments/${encodeURIComponent(paymentId)}`);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[asaas] Falha ao consultar cobrança (HTTP ${response.status}): ${body}`);
    throw new AsaasApiError(`Falha ao consultar cobrança na Asaas (HTTP ${response.status}): ${body}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    value: data.value,
    externalReference: data.externalReference ?? null,
  };
}

/**
 * Valida o header `asaas-access-token` do webhook contra um segredo próprio
 * do Moove (`ASAAS_WEBHOOK_TOKEN`, o `authToken` configurado ao criar ESTE
 * webhook específico) — importante porque a mesma conta Asaas do usuário já
 * tem outro webhook cadastrado (de outro projeto, com outro authToken). Cada
 * webhook na Asaas tem seu próprio authToken, então essa validação também
 * garante que só aceitamos notificações do webhook do Moove.
 */
export function verificarWebhookAsaas(tokenRecebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !tokenRecebido) return false;
  if (tokenRecebido.length !== esperado.length) return false;
  try {
    return timingSafeEqual(Buffer.from(tokenRecebido), Buffer.from(esperado));
  } catch {
    return false;
  }
}
