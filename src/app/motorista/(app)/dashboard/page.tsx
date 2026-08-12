import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { LocationSharingPanel } from "@/components/motorista/LocationSharingPanel";
import { RotaPanel } from "@/components/motorista/RotaPanel";

export default async function MotoristaDashboardPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const [veiculosCount, vinculosAtivos, convitesPendentes, escolaNaoConfirmada] = await Promise.all([
    prisma.veiculo.count({ where: { motoristaId: motorista.id } }),
    prisma.vinculo.count({ where: { motoristaId: motorista.id, status: "ATIVO" } }),
    prisma.convite.count({ where: { motoristaId: motorista.id, status: "PENDENTE" } }),
    // Só conta escola que JÁ foi geocodificada (tem coordenada) mas ainda não
    // foi confirmada por uma pessoa no mapa — escola sem coordenada nenhuma
    // já tem seu próprio aviso na tela "Minhas escolas".
    prisma.escola.count({
      where: { motoristaId: motorista.id, enderecoConfirmado: false, enderecoLatitude: { not: null } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {motorista.nome.split(" ")[0]}</h1>
        <p className="text-neutral-500 dark:text-neutral-400">Painel do motorista</p>
      </div>

      {veiculosCount === 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Você ainda não cadastrou um veículo.{" "}
          <Link href="/motorista/veiculos" className="font-medium underline">
            Cadastrar veículo
          </Link>
        </div>
      )}

      {escolaNaoConfirmada > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {escolaNaoConfirmada === 1
            ? "O endereço de uma escola ainda não foi confirmado no mapa — a localização automática pode estar imprecisa."
            : `O endereço de ${escolaNaoConfirmada} escolas ainda não foi confirmado no mapa — a localização automática pode estar imprecisa.`}{" "}
          <Link href="/motorista/escolas" className="font-medium underline">
            Confirmar localização
          </Link>
        </div>
      )}

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
