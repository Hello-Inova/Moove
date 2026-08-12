"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { apiPostJson } from "@/lib/api-client";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { suportaPush, urlBase64ToUint8Array } from "@/lib/push/client";

type Estado = "verificando" | "sem-suporte" | "inativo" | "ativo" | "negado";

/**
 * Liga/desliga uma inscrição de Web Push — componente genérico usado tanto
 * pelo responsável (alerta sonoro de proximidade, ver PushAlertaToggle.tsx)
 * quanto pelo motorista (avisos de convite aceito / cobrança gerada). Cada
 * papel aponta pros próprios endpoints de subscribe/unsubscribe, já que a
 * subscription é salva com responsavelId OU motoristaId (nunca os dois — ver
 * schema, model PushSubscription).
 *
 * Limitação de plataforma (não é bug do Moove): no iPhone/iPad, o Safari só
 * entrega push pra sites adicionados à tela de início (Ajustar > Compartilhar
 * > "Adicionar à Tela de Início"), exigência da própria Apple desde o iOS
 * 16.4. Em Android e computador funciona direto, sem esse passo.
 */
export function PushToggle({
  title,
  description,
  subscribeUrl,
  unsubscribeUrl,
  ativarLabel = "Ativar notificações",
}: {
  title: string;
  description: ReactNode;
  subscribeUrl: string;
  unsubscribeUrl: string;
  ativarLabel?: string;
}) {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checar() {
      if (!suportaPush()) {
        setEstado("sem-suporte");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("negado");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
        const subscription = await registration?.pushManager.getSubscription();
        setEstado(subscription ? "ativo" : "inativo");
      } catch {
        setEstado("inativo");
      }
    }
    void checar();
  }, []);

  async function ativar() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      toast.error("Notificações ainda não configuradas neste ambiente.");
      return;
    }

    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.register("/sw-push.js");
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado("negado");
        setLoading(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      const result = await apiPostJson(subscribeUrl, { endpoint: json.endpoint, keys: json.keys });

      if (!result.ok) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      setEstado("ativo");
      toast.success("Notificações ativadas neste dispositivo.");
    } catch {
      toast.error("Não foi possível ativar as notificações agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function desativar() {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiPostJson(unsubscribeUrl, { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setEstado("inativo");
      toast.success("Notificações desativadas.");
    } catch {
      toast.error("Não foi possível desativar as notificações agora.");
    } finally {
      setLoading(false);
    }
  }

  if (estado === "verificando") return null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>

      {estado === "sem-suporte" && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          Seu navegador não suporta esse tipo de notificação. No iPhone, adicione o Moove à tela de início
          (compartilhar → &quot;Adicionar à Tela de Início&quot;) e tente de novo por lá.
        </p>
      )}

      {estado === "negado" && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          As notificações estão bloqueadas para este site nas configurações do navegador — habilite manualmente para
          ativar.
        </p>
      )}

      {(estado === "inativo" || estado === "ativo") && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {estado === "ativo" ? (
            <>
              <span className="text-sm text-green-600 dark:text-green-400">Ativado neste dispositivo.</span>
              <button onClick={desativar} disabled={loading} className={secondaryButtonClass + " w-auto px-4"}>
                {loading ? "Desativando…" : "Desativar"}
              </button>
            </>
          ) : (
            <button onClick={ativar} disabled={loading} className={primaryButtonClass + " w-auto px-4"}>
              {loading ? "Ativando…" : ativarLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
