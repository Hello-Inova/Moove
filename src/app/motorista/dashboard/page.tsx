import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { MotoristaShell } from "@/components/motorista/MotoristaShell";
import { LocationSharingPanel } from "@/components/motorista/LocationSharingPanel";
import { RotaPanel } from "@/components/motorista/RotaPanel";

export default async function MotoristaDashboardPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const [veiculosCount, vinculosAtivos, convitesPendentes] = await Promise.all([
    prisma.veiculo.count({ where: { motoristaId: motorista.id } }),
    prisma.vinculo.count({ where: { motoristaId: motorista.id, status: "ATIVO" } }),
    prisma.convite.count({ where: { motoristaId: motorista.id, status: "PENDENTE" } }),
  ]);

  return (
    <MotoristaShell>
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

        <LocationSharingPanel />

        <RotaPanel />

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Veículos" value={veiculosCount} href="/motorista/veiculos" />
          <StatCard label="Vínculos ativos" value={vinculosAtivos} href="/motorista/vinculos" />
          <StatCard label="Convites pendentes" value={convitesPendentes} href="/motorista/convites" />
        </div>
      </div>
    </MotoristaShell>
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
