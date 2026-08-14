import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatarBRL } from "@/lib/subscription/plans";
import { secondaryButtonClass } from "@/components/ui/form-elements";
import { GuideTour, type GuideStep } from "@/components/ui/GuideTour";

const TOUR_STEPS: GuideStep[] = [
  {
    targetId: "tour-cobrancas-lista",
    title: "Pagamentos da sua assinatura",
    text: "Aqui fica o histórico do que você pagou pelo plano da plataforma. Não confunda com a cobrança por aluno excedente, que fica na aba \"Alunos\".",
  },
  {
    targetId: "tour-cobrancas-planos",
    title: "Trocar de plano",
    text: "Precisa mudar de plano? Clique aqui pra ver as opções disponíveis.",
  },
];

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
};

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: "bg-blue-100 text-blue-800",
  APROVADO: "bg-green-100 text-green-800",
  RECUSADO: "bg-red-100 text-red-700",
  CANCELADO: "bg-neutral-200 text-neutral-600",
};

export default async function MotoristaCobrancasPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const pagamentos = await prisma.pagamento.findMany({
    where: { assinatura: { motoristaId: motorista.id } },
    include: { assinatura: true },
    orderBy: { criadoEm: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cobranças</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Histórico de pagamentos das suas assinaturas.</p>
        </div>
        <GuideTour steps={TOUR_STEPS} />
      </div>

      <div id="tour-cobrancas-planos">
        <Link href="/motorista/planos" className={secondaryButtonClass + " w-auto px-4"}>
          Ver planos
        </Link>
      </div>

      <div id="tour-cobrancas-lista" className="space-y-3">
        {pagamentos.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum pagamento gerado ainda.</p>
        )}
        {pagamentos.map((p) => (
          <div key={p.id} className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Plano {p.assinatura.planoLabel || p.assinatura.tipoPlano}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[p.status]}`}>
                {STATUS_LABEL[p.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {p.criadoEm.toLocaleDateString("pt-BR")}
              {p.pagoEm && ` · pago em ${p.pagoEm.toLocaleDateString("pt-BR")}`}
            </p>
            <p className="mt-1 font-semibold">{formatarBRL(Number(p.valor))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
