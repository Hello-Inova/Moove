import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { GuideTour, type GuideStep } from "@/components/ui/GuideTour";

const TOUR_STEPS: GuideStep[] = [
  {
    targetId: "tour-relatorios-lista",
    title: "Histórico de percursos",
    text: "Cada linha é um dia de rota encerrada — clique pra ver detalhes de embarque, ausência e distância percorrida.",
  },
];

function formatarDistancia(m: number | null): string {
  if (m === null) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatarDuracao(inicio: Date, fim: Date | null): string {
  if (!fim) return "em andamento";
  const min = Math.round((fim.getTime() - inicio.getTime()) / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, "0")}`;
}

export default async function MotoristaRelatoriosPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const percursos = await prisma.percursoDia.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { iniciadoEm: "desc" },
    take: 60,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Histórico dos percursos encerrados — clique em um dia para ver os detalhes.
          </p>
        </div>
        <GuideTour steps={TOUR_STEPS} />
      </div>

      <div id="tour-relatorios-lista" className="space-y-3">
        {percursos.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Nenhum percurso registrado ainda. Ao clicar em &quot;Encerrar rota&quot; no painel de rota, o dia
            aparece aqui.
          </p>
        )}

        {percursos.map((p) => (
          <Link
            key={p.id}
            href={`/motorista/relatorios/${p.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 transition hover:border-neutral-400 dark:bg-neutral-900 dark:border-neutral-700"
          >
            <div>
              <p className="font-medium">
                {p.data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {p.iniciadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} –{" "}
                {p.encerradoEm
                  ? p.encerradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  : "em andamento"}{" "}
                · {formatarDuracao(p.iniciadoEm, p.encerradoEm)} · {formatarDistancia(p.distanciaMetros)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-800 dark:bg-green-950/40 dark:text-green-300">
                {p.totalEmbarcaram} embarcaram
              </span>
              {p.totalAusentes > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {p.totalAusentes} ausentes
                </span>
              )}
              {!p.encerradoEm && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  em andamento
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
