import { PushToggle } from "@/components/ui/PushToggle";

/**
 * Liga/desliga o alerta sonoro de proximidade (Web Push) — o motorista
 * configura quantos minutos de antecedência quer avisar (ver
 * LocationSharingPanel.tsx, do lado dele); aqui o responsável só precisa
 * autorizar notificações uma vez. Ver PushToggle.tsx pra lógica compartilhada.
 */
export function PushAlertaToggle() {
  return (
    <PushToggle
      title="Alerta sonoro de chegada"
      description="Receba um aviso sonoro quando o motorista estiver perto do seu endereço — funciona mesmo com o app em segundo plano."
      subscribeUrl="/api/responsavel/push/subscribe"
      unsubscribeUrl="/api/responsavel/push/unsubscribe"
      ativarLabel="Ativar alerta sonoro"
    />
  );
}
