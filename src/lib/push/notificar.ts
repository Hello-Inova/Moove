import "server-only";

import { prisma } from "@/lib/prisma";
import { enviarNotificacaoPush, PushNaoConfiguradoError, PushSubscriptionInvalidaError } from "@/lib/push/webpush";

/**
 * Manda um push pra todas as subscriptions de um motorista ou responsável —
 * concentra o try/catch/limpeza que antes só existia duplicado dentro do
 * alerta de proximidade (ver /api/motorista/localizacao). Nunca lança: um
 * push que falha (VAPID não configurada, subscription expirada) não pode
 * quebrar o fluxo principal (convite aceito, cobrança gerada, etc.) que
 * disparou a notificação.
 */
export async function notificarPush(
  alvo: { motoristaId: string } | { responsavelId: string },
  payload: { title: string; body: string; tag?: string }
): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: "motoristaId" in alvo ? { motoristaId: alvo.motoristaId } : { responsavelId: alvo.responsavelId },
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await enviarNotificacaoPush(sub, payload);
      } catch (err) {
        if (err instanceof PushSubscriptionInvalidaError) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return;
        }
        if (err instanceof PushNaoConfiguradoError) {
          console.warn("[push]", err.message);
          return;
        }
        console.error("[push] falha ao enviar", err);
      }
    })
  );
}
