import { redirect } from "next/navigation";
import { CircleDollarSign } from "lucide-react";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { expirarConvitesVencidos } from "@/lib/convite";
import { getAssinaturaAtual } from "@/lib/subscription/service";
import { formatarBRL } from "@/lib/subscription/plans";
import { CadastrarResponsavelForm } from "@/components/motorista/CadastrarResponsavelForm";
import { RevogarButton } from "@/components/motorista/RevogarButton";
import { CopyCodeButton } from "@/components/motorista/CopyCodeButton";
import { GuideTour, type GuideStep } from "@/components/ui/GuideTour";

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  USADO: "Usado",
  EXPIRADO: "Expirado",
  REVOGADO: "Revogado",
};

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: "bg-blue-100 text-blue-800",
  USADO: "bg-green-100 text-green-800",
  EXPIRADO: "bg-neutral-200 text-neutral-600",
  REVOGADO: "bg-red-100 text-red-700",
};

export default async function MotoristaConvitesPage() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  await expirarConvitesVencidos(motorista.id);

  const [convites, assinatura] = await Promise.all([
    prisma.convite.findMany({
      where: { motoristaId: motorista.id },
      orderBy: { criadoEm: "desc" },
      include: { usadoPorResponsavel: { select: { nome: true } } },
    }),
    getAssinaturaAtual(motorista.id),
  ]);

  const assinaturaAtiva = assinatura?.status === "ATIVA";
  const alunosGratis = assinaturaAtiva ? assinatura.alunosGratis : null;
  const valorPorAlunoExcedente = assinaturaAtiva ? Number(assinatura.valorPorAlunoExcedente) : null;

  const tourSteps: GuideStep[] = [
    {
      targetId: "tour-convite-aviso",
      title: "Cada aluno vinculado pode gerar cobrança",
      text:
        assinaturaAtiva && alunosGratis !== null && valorPorAlunoExcedente !== null
          ? `No seu plano atual, os primeiros ${alunosGratis} aluno${alunosGratis === 1 ? "" : "s"} vinculado${alunosGratis === 1 ? "" : "s"} são grátis. A partir do próximo, o sistema gera uma cobrança de ${formatarBRL(valorPorAlunoExcedente)} a cada 30 dias de vínculo ativo — é você quem paga essa cobrança direto pela Asaas (aba "Alunos"), com PIX ou cartão. Fique de olho nisso antes de compartilhar muitos convites de uma vez.`
          : "Assim que você ativar um plano pago, cada aluno vinculado além da franquia grátis do plano passa a gerar uma cobrança recorrente (a cada 30 dias) — é você quem paga essa cobrança direto pela Asaas, na aba \"Alunos\". Dá uma olhada na aba \"Planos\" pra saber a franquia e o valor antes de compartilhar muitos convites de uma vez.",
    },
    {
      targetId: "tour-convite-gerar",
      title: "Cadastre o responsável e o contrato",
      text: "Preencha os dados da família, do aluno e os termos da mensalidade. Enviamos um link (por e-mail e, se quiser, WhatsApp) pra ele completar o próprio cadastro e assinar o contrato — o vínculo é criado sozinho na assinatura, sem precisar de código.",
    },
    {
      targetId: "tour-convite-lista",
      title: "Acompanhe o status",
      text: "Aqui você vê se o convite está pendente, já foi usado, expirou ou foi revogado — dá pra revogar um convite pendente a qualquer momento.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Convites</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Cadastre o responsável e o contrato — enviamos o link pra ele completar o cadastro e assinar.
          </p>
        </div>
        <GuideTour steps={tourSteps} />
      </div>

      <div
        id="tour-convite-aviso"
        className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          {assinaturaAtiva && alunosGratis !== null && valorPorAlunoExcedente !== null ? (
            <>
              <strong>Atenção:</strong> seu plano inclui {alunosGratis} aluno{alunosGratis === 1 ? "" : "s"} grátis.
              A partir do próximo aluno vinculado, é gerada uma cobrança de {formatarBRL(valorPorAlunoExcedente)} a
              cada 30 dias de vínculo ativo — é você quem paga, direto pela Asaas, na aba{" "}
              <span className="font-medium">Alunos</span>.
            </>
          ) : (
            <>
              <strong>Atenção:</strong> ao ativar um plano pago, cada aluno vinculado além da franquia grátis passa a
              gerar uma cobrança recorrente que você mesmo paga, direto pela Asaas. Confira os valores na aba{" "}
              <span className="font-medium">Planos</span> antes de compartilhar muitos convites.
            </>
          )}
        </p>
      </div>

      <div id="tour-convite-gerar">
        <CadastrarResponsavelForm />
      </div>

      <div id="tour-convite-lista" className="space-y-3">
        {convites.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum convite cadastrado ainda.</p>
        )}
        {convites.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white shadow-sm p-4 dark:bg-neutral-900 dark:border-neutral-700"
          >
            <div className="flex flex-wrap items-center gap-3">
              {c.tipo === "NOMINAL" ? (
                <span className="font-medium">{c.nomeResponsavel}</span>
              ) : (
                <CopyCodeButton codigo={c.codigo} />
              )}
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {c.status === "PENDENTE" && (
                <span>{c.tipo === "NOMINAL" ? "Aguardando cadastro/assinatura — expira" : "Expira"} em {c.expiraEm.toLocaleDateString("pt-BR")}</span>
              )}
              {c.status === "USADO" && <span>Usado por {c.usadoPorResponsavel?.nome}</span>}
            </div>
            {c.status === "PENDENTE" && (
              <RevogarButton
                url={`/api/motorista/convites/${c.id}/revogar`}
                confirmMessage="Revogar este convite? Ele deixará de poder ser usado."
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
