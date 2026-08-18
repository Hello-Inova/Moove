import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { LocationSharingPanel } from "@/components/motorista/LocationSharingPanel";
import { RotaPanel } from "@/components/motorista/RotaPanel";
import { OnboardingChecklist } from "@/components/motorista/OnboardingChecklist";
import { GuideTour, type GuideStep } from "@/components/ui/GuideTour";

const TOUR_STEPS: GuideStep[] = [
  {
    targetId: "tour-checklist",
    title: "Confira o que falta configurar",
    text: "Essa lista mostra os passos iniciais — cadastrar veículo, escola, chave PIX e vincular o primeiro aluno. Vá marcando conforme for completando.",
  },
  {
    targetId: "tour-location",
    title: "Compartilhe sua localização",
    text: "Toque em \"Iniciar rota\" pra começar a compartilhar sua localização em tempo real com os responsáveis vinculados. Mantenha o Moove aberto na tela enquanto estiver rodando.",
  },
  {
    targetId: "tour-rota",
    title: "Acompanhe a rota do dia",
    text: "Com a localização ativa, aparece aqui o mapa com a rota otimizada até os alunos, na ordem de embarque. Marque cada aluno como \"Embarcou\" ou \"Ausente\" conforme for passando, e clique em \"Encerrar rota\" no fim do trajeto.",
  },
];

export default async function MotoristaDashboardPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const [veiculosCount, escolasCount, vinculosAtivos, escolaNaoConfirmada] = await Promise.all([
    prisma.veiculo.count({ where: { motoristaId: motorista.id } }),
    prisma.escola.count({ where: { motoristaId: motorista.id } }),
    prisma.vinculo.count({ where: { motoristaId: motorista.id, status: "ATIVO" } }),
    // Só conta escola que JÁ foi geocodificada (tem coordenada) mas ainda não
    // foi confirmada por uma pessoa no mapa — escola sem coordenada nenhuma
    // já tem seu próprio aviso na tela "Minhas escolas".
    prisma.escola.count({
      where: { motoristaId: motorista.id, enderecoConfirmado: false, enderecoLatitude: { not: null } },
    }),
  ]);

  const checklist = [
    { label: "Cadastrar um veículo", href: "/motorista/veiculos", done: veiculosCount > 0 },
    { label: "Cadastrar uma escola", href: "/motorista/escolas", done: escolasCount > 0 },
    ...(escolasCount > 0
      ? [{ label: "Confirmar a localização da escola no mapa", href: "/motorista/escolas", done: escolaNaoConfirmada === 0 }]
      : []),
    { label: "Configurar sua chave PIX", href: "/motorista/vinculos", done: Boolean(motorista.chavePix) },
    { label: "Vincular seu primeiro aluno (gerar um convite)", href: "/motorista/convites", done: vinculosAtivos > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {motorista.nome.split(" ")[0]}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Rota do dia</p>
        </div>
        <GuideTour steps={TOUR_STEPS} />
      </div>

      <div id="tour-checklist">
        <OnboardingChecklist items={checklist} />
      </div>

      <div id="tour-location">
        <LocationSharingPanel />
      </div>

      <div id="tour-rota">
        <RotaPanel />
      </div>
    </div>
  );
}
