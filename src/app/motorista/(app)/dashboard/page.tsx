import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { LocationSharingPanel } from "@/components/motorista/LocationSharingPanel";
import { RotaPanel } from "@/components/motorista/RotaPanel";
import { OnboardingChecklist } from "@/components/motorista/OnboardingChecklist";

export default async function MotoristaDashboardPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const [veiculosCount, escolasCount, vinculosAtivos, convitesPendentes, escolaNaoConfirmada] = await Promise.all([
    prisma.veiculo.count({ where: { motoristaId: motorista.id } }),
    prisma.escola.count({ where: { motoristaId: motorista.id } }),
    prisma.vinculo.count({ where: { motoristaId: motorista.id, status: "ATIVO" } }),
    prisma.convite.count({ where: { motoristaId: motorista.id, status: "PENDENTE" } }),
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
      <div>
        <h1 className="text-2xl font-semibold">Olá, {motorista.nome.split(" ")[0]}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Painel do motorista</p>
      </div>

      <OnboardingChecklist items={checklist} />

      <LocationSharingPanel />

      <RotaPanel />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Veículos" value={veiculosCount} href="/motorista/veiculos" />
        <StatCard label="Vínculos ativos" value={vinculosAtivos} href="/motorista/vinculos" />
        <StatCard label="Convites pendentes" value={convitesPendentes} href="/motorista/convites" />
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 transition hover:border-neutral-400 dark:bg-neutral-900 dark:border-neutral-700"
    >
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Link>
  );
}
