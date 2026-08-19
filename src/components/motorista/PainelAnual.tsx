"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Users, School, Wallet, CheckCircle2, Clock, AlertTriangle, Route as RouteIcon } from "lucide-react";

import { formatarBRL } from "@/lib/subscription/plans";
import type { PainelDataAnual } from "@/lib/painel/dashboard-data";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Visão anual do Painel (item 11 do pedido) — previsão dos 12 meses do ano
 * selecionado, considerando a vigência cadastrada em cada aluno. Meses já
 * passados/gerados pelo cron mostram valor real; meses futuros mostram
 * projeção (marcada como "previsto").
 */
export function PainelAnual({ dados, anoAtualDoSistema }: { dados: PainelDataAnual; anoAtualDoSistema: number }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Painel — previsão anual</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 sm:text-base">
            Soma mês a mês considerando a vigência cadastrada de cada aluno.
          </p>
        </div>
        <Link
          href="/motorista/painel"
          className="text-sm font-medium text-brand-orange-dark underline underline-offset-2"
        >
          Voltar pro mês atual
        </Link>
      </div>

      <div className="flex items-center justify-between gap-1 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <Link
          href={`/motorista/painel?mes=todos&ano=${dados.ano - 1}`}
          aria-label="Ano anterior"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <span className="text-base font-medium">{dados.ano}</span>
        <Link
          href={`/motorista/painel?mes=todos&ano=${dados.ano + 1}`}
          aria-label="Próximo ano"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 ${
            dados.ano >= anoAtualDoSistema + 1 ? "pointer-events-none opacity-30" : ""
          }`}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        <div className="flex min-h-[104px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 p-3 text-white shadow-sm sm:min-h-[124px] sm:p-4">
          <div className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/30 sm:h-10 sm:w-10">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-medium leading-snug text-white/85 sm:text-xs">Previsto no ano</p>
          <p className="mt-auto break-words pt-1 text-base font-bold leading-tight sm:text-2xl">{formatarBRL(dados.totalEntradaPrevista)}</p>
        </div>
        <div className="flex min-h-[104px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 text-white shadow-sm sm:min-h-[124px] sm:p-4">
          <div className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/30 sm:h-10 sm:w-10">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-medium leading-snug text-white/85 sm:text-xs">Recebido no ano</p>
          <p className="mt-auto break-words pt-1 text-base font-bold leading-tight sm:text-2xl">{formatarBRL(dados.totalRecebido)}</p>
        </div>
        <div className="flex min-h-[104px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-3 text-white shadow-sm sm:min-h-[124px] sm:p-4">
          <div className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/30 sm:h-10 sm:w-10">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-medium leading-snug text-white/85 sm:text-xs">Pendente no ano</p>
          <p className="mt-auto break-words pt-1 text-base font-bold leading-tight sm:text-2xl">{formatarBRL(dados.totalPendente)}</p>
        </div>
        <div className="flex min-h-[104px] flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-red-600 p-3 text-white shadow-sm sm:min-h-[124px] sm:p-4">
          <div className="mb-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-400/30 sm:h-10 sm:w-10">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-[11px] font-medium leading-snug text-white/85 sm:text-xs">Atrasado no ano</p>
          <p className="mt-auto break-words pt-1 text-base font-bold leading-tight sm:text-2xl">{formatarBRL(dados.totalAtrasado)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        <p className="flex items-center gap-1.5"><Users className="h-4 w-4 text-neutral-400" aria-hidden="true" /> {dados.alunosAtivos} aluno{dados.alunosAtivos === 1 ? "" : "s"} ativo{dados.alunosAtivos === 1 ? "" : "s"}</p>
        <p className="flex items-center gap-1.5"><School className="h-4 w-4 text-neutral-400" aria-hidden="true" /> {dados.escolasAtivas} escola{dados.escolasAtivas === 1 ? "" : "s"}</p>
        <p className="flex items-center gap-1.5"><RouteIcon className="h-4 w-4 text-neutral-400" aria-hidden="true" /> {dados.totalKmRodados.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km rodados</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {dados.porMes.map((m) => (
            <li key={m.mes} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-medium">{MESES_PT[m.mes - 1]}</span>
              <span className="flex flex-wrap items-center gap-3 text-neutral-600 dark:text-neutral-300">
                <span>{formatarBRL(m.entradaPrevista)}</span>
                {!m.gerado && (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    previsto
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
