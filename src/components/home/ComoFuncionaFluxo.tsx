import type { ReactNode } from "react";
import { Home, CheckCircle2, School, ChevronRight, ChevronDown, AlertTriangle } from "lucide-react";

type Etapa = { icon: ReactNode; titulo: string; descricao: string };

const ETAPAS_IDA: Etapa[] = [
  { icon: <Home className="h-5 w-5" aria-hidden="true" />, titulo: "Casa do aluno", descricao: "Motorista chega até o endereço cadastrado pelo responsável" },
  { icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />, titulo: "Embarque", descricao: "Marca \"Embarcou\" ou \"Ausente\" na hora, direto pelo app" },
  { icon: <School className="h-5 w-5" aria-hidden="true" />, titulo: "Escola", descricao: "Aluno é deixado na escola em segurança" },
];

const ETAPAS_VOLTA: Etapa[] = [
  { icon: <School className="h-5 w-5" aria-hidden="true" />, titulo: "Escola", descricao: "Motorista busca o aluno na saída" },
  { icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />, titulo: "Embarque", descricao: "Marca \"Embarcou\" assim que pega o aluno" },
  { icon: <Home className="h-5 w-5" aria-hidden="true" />, titulo: "Casa do aluno", descricao: "Aluno é entregue direto na porta de casa" },
];

function FluxoStep({ etapa, corIcone, ultimo }: { etapa: Etapa; corIcone: string; ultimo: boolean }) {
  return (
    <>
      <div className="flex flex-1 items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm dark:border-neutral-700 dark:bg-neutral-900 sm:flex-col sm:text-center">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${corIcone}`}>
          {etapa.icon}
        </div>
        <div>
          <p className="font-semibold text-brand-navy dark:text-white">{etapa.titulo}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{etapa.descricao}</p>
        </div>
      </div>
      {!ultimo && (
        <div className="flex shrink-0 items-center justify-center py-0.5 sm:px-1 sm:py-0">
          <ChevronDown className="h-5 w-5 text-neutral-300 dark:text-neutral-600 sm:hidden" aria-hidden="true" />
          <ChevronRight className="hidden h-5 w-5 text-neutral-300 dark:text-neutral-600 sm:block" aria-hidden="true" />
        </div>
      )}
    </>
  );
}

function Fluxo({ titulo, etapas, corIcone }: { titulo: string; etapas: Etapa[]; corIcone: string }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {titulo}
      </p>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {etapas.map((etapa, i) => (
          <FluxoStep key={etapa.titulo + i} etapa={etapa} corIcone={corIcone} ultimo={i === etapas.length - 1} />
        ))}
      </div>
    </div>
  );
}

/**
 * Explica visualmente o fluxo de coleta (ida) e entrega (volta) dos alunos
 * na home pública — reflete de verdade o que o motorista faz no app
 * (RotaPanel: botão "Ir"/"Embarcou"/"Ausente", botão "Iniciar retorno" pra
 * volta, ver README > Rota do dia), não é só uma ilustração genérica.
 */
export function ComoFuncionaFluxo() {
  return (
    <section className="w-full max-w-3xl space-y-8 rounded-3xl border border-neutral-200 bg-white/60 p-6 text-left shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/60 sm:p-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-brand-navy dark:text-white sm:text-2xl">
          Como funciona a rota do dia
        </h2>
        <p className="mx-auto mt-1 max-w-lg text-sm text-neutral-500 dark:text-neutral-400">
          Da porta de casa até a escola, e de volta — tudo acompanhado em tempo real, sem precisar de rota pré-fixa.
        </p>
      </div>

      <Fluxo titulo="Ida — de casa pra escola" etapas={ETAPAS_IDA} corIcone="bg-brand-navy" />
      <Fluxo titulo="Volta — da escola pra casa" etapas={ETAPAS_VOLTA} corIcone="bg-brand-orange" />

      <div className="flex items-start gap-2.5 rounded-2xl border border-red-100 bg-red-50/70 p-3.5 text-left dark:border-red-900/50 dark:bg-red-950/20">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
        <p className="text-sm text-red-700 dark:text-red-400">
          Aluno marcado como <strong>ausente</strong> na ida não entra na lista de busca da volta — o motorista nunca
          perde tempo passando na escola por quem não foi levado.
        </p>
      </div>
    </section>
  );
}
