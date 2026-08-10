import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PercursoMap } from "@/components/map/PercursoMap";

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

const STATUS_LABEL: Record<string, string> = {
  EMBARCOU: "Embarcou",
  AUSENTE: "Ausente",
};

const STATUS_CLASS: Record<string, string> = {
  EMBARCOU: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  AUSENTE: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
};

export default async function MotoristaRelatorioDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const percurso = await prisma.percursoDia.findUnique({ where: { id } });
  if (!percurso || percurso.motoristaId !== motorista.id) notFound();

  const [pontos, vinculos, embarques] = await Promise.all([
    prisma.percursoPonto.findMany({
      where: { percursoId: percurso.id },
      orderBy: { criadoEm: "asc" },
      select: { latitude: true, longitude: true },
    }),
    prisma.vinculo.findMany({
      where: { motoristaId: motorista.id, status: "ATIVO" },
      select: {
        id: true,
        aluno: { select: { nome: true } },
        responsavel: { select: { nome: true } },
        escola: { select: { nome: true } },
      },
    }),
    prisma.embarqueDia.findMany({
      where: { data: percurso.data, vinculo: { motoristaId: motorista.id } },
      select: { vinculoId: true, status: true },
    }),
  ]);

  const statusPorVinculo = Object.fromEntries(embarques.map((e) => [e.vinculoId, e.status]));
  const pontosMapa: [number, number][] = pontos.map((p) => [p.latitude, p.longitude]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/motorista/relatorios" className="text-sm text-neutral-500 underline underline-offset-2 dark:text-neutral-400">
          ← Todos os relatórios
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {percurso.data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          {percurso.iniciadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} –{" "}
          {percurso.encerradoEm
            ? percurso.encerradoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            : "em andamento"}{" "}
          · {formatarDuracao(percurso.iniciadoEm, percurso.encerradoEm)} · {formatarDistancia(percurso.distanciaMetros)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Total de alunos</p>
          <p className="text-2xl font-semibold">{percurso.totalAlunos}</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <p className="text-sm text-green-800 dark:text-green-300">Embarcaram</p>
          <p className="text-2xl font-semibold text-green-800 dark:text-green-300">{percurso.totalEmbarcaram}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-300">Ausentes</p>
          <p className="text-2xl font-semibold text-amber-800 dark:text-amber-300">{percurso.totalAusentes}</p>
        </div>
      </div>

      <div className="h-72 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <PercursoMap pontos={pontosMapa} />
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 dark:bg-neutral-900 dark:border-neutral-700">
        <h2 className="mb-3 font-medium">Alunos</h2>
        <ul className="space-y-2">
          {vinculos.map((v) => {
            const status = statusPorVinculo[v.id];
            return (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-700"
              >
                <div>
                  <p className="font-medium">{v.aluno.nome}</p>
                  <p className="text-neutral-500 dark:text-neutral-400">
                    {v.responsavel.nome}
                    {v.escola?.nome ? ` · ${v.escola.nome}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    status
                      ? STATUS_CLASS[status]
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  {status ? STATUS_LABEL[status] : "Sem marcação"}
                </span>
              </li>
            );
          })}
          {vinculos.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum vínculo ativo.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
