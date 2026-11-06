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
      title="Notificações da rota"
      description="Ative para receber no celular o aviso quando o motorista clicar em Ir e avisar e as atualizações da previsão de chegada a cada minuto. Também inclui o alerta de proximidade."
      subscribeUrl="/api/responsavel/push/subscribe"
      unsubscribeUrl="/api/responsavel/push/unsubscribe"
      ativarLabel="Ativar notificações da rota"
    />
  );
}
