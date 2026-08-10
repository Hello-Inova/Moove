import "server-only";
import webpush from "web-push";

// Web Push (protocolo padrão do navegador, RFC 8030) — diferente de SMS/e-mail,
// não depende de nenhum serviço terceiro pago: o próprio navegador
// (Chrome/Firefox/Edge usam o push service do Google/Mozilla/Microsoft por
// baixo dos panos, de graça) entrega a notificação pro Service Worker do
// site mesmo com a aba fechada, contanto que o usuário tenha se inscrito
// uma vez (ver PushSubscribeButton.tsx) e o navegador esteja aberto em
// segundo plano no aparelho (Android/desktop; no iOS Safari exige o site
// "adicionado à tela de início" — limitação da Apple, não do Moove).
//
// As chaves VAPID (par de chaves só do Moove, sem precisar de conta em
// nenhum serviço externo) identificam quem está mandando o push — geradas
// uma vez com `npx web-push generate-vapid-keys` e guardadas como env vars.

let configurado = false;

function configurar() {
  if (configurado) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@moove.app";

  if (!publicKey || !privateKey) {
    throw new PushNaoConfiguradoError();
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configurado = true;
}

export class PushNaoConfiguradoError extends Error {
  constructor() {
    super("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — alerta de push desativado.");
    this.name = "PushNaoConfiguradoError";
  }
}

export type PushSubscriptionAlvo = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Erro específico de inscrição inválida/expirada (404/410) — quem chama
 * usa isso pra saber que deve remover a subscription do banco. */
export class PushSubscriptionInvalidaError extends Error {
  constructor(public statusCode: number) {
    super(`Subscription de push inválida (status ${statusCode}) — remover do banco.`);
    this.name = "PushSubscriptionInvalidaError";
  }
}

export async function enviarNotificacaoPush(
  alvo: PushSubscriptionAlvo,
  payload: { title: string; body: string; tag?: string }
): Promise<void> {
  configurar();

  try {
    await webpush.sendNotification(
      { endpoint: alvo.endpoint, keys: { p256dh: alvo.p256dh, auth: alvo.auth } },
      JSON.stringify(payload)
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      throw new PushSubscriptionInvalidaError(statusCode);
    }
    throw err;
  }
}
