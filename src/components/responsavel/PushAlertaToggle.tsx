"use client";

import { useEffect, useState } from "react";

import { apiPostJson } from "@/lib/api-client";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { suportaPush, urlBase64ToUint8Array } from "@/lib/push/client";

type Estado = "verificando" | "sem-suporte" | "inativo" | "ativo" | "negado";

/**
 * Liga/desliga o alerta sonoro de proximidade (Web Push) — o motorista
 * configura quantos minutos de antecedência quer avisar (ver
 * LocationSharingPanel.tsx, do lado dele); aqui o responsável só precisa
 * autorizar notificações uma vez.
 *
 * Limitação de plataforma (não é bug do Moove): no iPhone/iPad, o Safari só
 * entrega push pra sites adicionados à tela de início (Ajustar > Compartilhar
 * > "Adicionar à Tela de Início"), exigência da própria Apple desde o iOS
 * 16.4. Em Android e computador funciona direto, sem esse passo.
 */
export function PushAlertaToggle() {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      setErro("Alerta de push ainda não configurado neste ambiente.");
      return;
    }

    setLoading(true);
    setErro(null);

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
      const result = await apiPostJson("/api/responsavel/push/subscribe", {
        endpoint: json.endpoint,
        keys: json.keys,
      });

      if (!result.ok) {
        setErro(result.error);
        setLoading(false);
        return;
      }

      setEstado("ativo");
    } catch {
      setErro("Não foi possível ativar o alerta agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function desativar() {
    setLoading(true);
    setErro(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw-push.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await apiPostJson("/api/responsavel/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setEstado("inativo");
    } catch {
      setErro("Não foi possível desativar o alerta agora.");
    } finally {
      setLoading(false);
    }
  }

  if (estado === "verificando") return null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
      <h2 className="font-medium">Alerta sonoro de chegada</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Receba um aviso sonoro quando o motorista estiver perto do seu endereço — funciona mesmo com o app em
        segundo plano.
      </p>

      {estado === "sem-suporte" && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          Seu navegador não suporta esse tipo de alerta. No iPhone, adicione o Moove à tela de início (compartilhar →
          &quot;Adicionar à Tela de Início&quot;) e tente de novo por lá.
        </p>
      )}

      {estado === "negado" && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          As notificações estão bloqueadas para este site nas configurações do navegador — habilite manualmente para
          ativar o alerta.
        </p>
      )}

      {(estado === "inativo" || estado === "ativo") && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {estado === "ativo" ? (
            <>
              <span className="text-sm text-green-600 dark:text-green-400">Alerta ativado neste dispositivo.</span>
              <button onClick={desativar} disabled={loading} className={secondaryButtonClass + " w-auto px-4"}>
                {loading ? "Desativando…" : "Desativar"}
              </button>
            </>
          ) : (
            <button onClick={ativar} disabled={loading} className={primaryButtonClass + " w-auto px-4"}>
              {loading ? "Ativando…" : "Ativar alerta sonoro"}
            </button>
          )}
        </div>
      )}

      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </section>
  );
}
