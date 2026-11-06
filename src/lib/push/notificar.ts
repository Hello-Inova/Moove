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
): Promise<{ dispositivosInscritos: number; entregasConfirmadas: number; configuracaoAusente: boolean }> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: "motoristaId" in alvo ? { motoristaId: alvo.motoristaId } : { responsavelId: alvo.responsavelId },
  });

  const resultados = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await enviarNotificacaoPush(sub, payload);
        return { entregue: true, configuracaoAusente: false };
      } catch (err) {
        if (err instanceof PushSubscriptionInvalidaError) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return { entregue: false, configuracaoAusente: false };
        }
        if (err instanceof PushNaoConfiguradoError) {
          console.warn("[push]", err.message);
          return { entregue: false, configuracaoAusente: true };
        }
        console.error("[push] falha ao enviar", err);
        return { entregue: false, configuracaoAusente: false };
      }
    })
  );

  return {
    dispositivosInscritos: subscriptions.length,
    entregasConfirmadas: resultados.filter((resultado) => resultado.entregue).length,
    configuracaoAusente: resultados.some((resultado) => resultado.configuracaoAusente),
  };
}
