import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Cake,
  Users,
  GraduationCap,
  School,
  Wallet,
  FileText,
} from "lucide-react";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { cardClass } from "@/components/ui/form-elements";
import { Badge } from "@/components/ui/Badge";
import { EditarPerfilAlunoButton } from "@/components/motorista/EditarPerfilAlunoButton";
import { MarcarMensalidadePagaButton } from "@/components/motorista/MarcarMensalidadePagaButton";
import { ContratosSection } from "@/components/motorista/ContratosSection";
import { linkWhatsApp } from "@/lib/whatsapp";

const GENERO_LABEL: Record<string, string> = { MASCULINO: "Masculino", FEMININO: "Feminino", OUTRO: "Outro" };
const PERIODO_LABEL: Record<string, string> = { MANHA: "Manhã", TARDE: "Tarde", INTEGRAL: "Integral", NOITE: "Noite" };
const MENSALIDADE_STATUS_VARIANT = {
  PENDENTE: "amber",
  PAGO: "green",
  CANCELADO: "neutral",
} as const;
const MENSALIDADE_STATUS_LABEL: Record<string, string> = { PENDENTE: "Pendente", PAGO: "Paga", CANCELADO: "Cancelada" };

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR");
}

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarMesReferencia(data: Date): string {
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function toIsoDate(data: Date | null): string | null {
  if (!data) return null;
  return data.toISOString().slice(0, 10);
}

export default async function PerfilAlunoPage({ params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const { id } = await params;

  const vinculo = await prisma.vinculo.findUnique({
    where: { id },
    include: {
      aluno: true,
      responsavel: true,
      escola: { select: { nome: true } },
      mensalidades: { orderBy: { mesReferencia: "desc" } },
      contratos: { orderBy: { criadoEm: "desc" } },
    },
  });

  if (!vinculo || vinculo.motoristaId !== motorista.id) notFound();

  const { aluno, responsavel, escola, mensalidades, contratos } = vinculo;

  const mensalidadesPendentes = mensalidades.filter((m) => m.status === "PENDENTE");
  const whatsappHref = linkWhatsApp(
    responsavel.telefone,
    `Olá, ${responsavel.nome}! Aqui é o motorista escolar de ${aluno.nome}.`
  );

  const enderecoCompleto = [
    responsavel.logradouro && `${responsavel.logradouro}${responsavel.numero ? `, ${responsavel.numero}` : ""}`,
    responsavel.complemento,
    responsavel.bairro,
    responsavel.cidade && responsavel.estado && `${responsavel.cidade} - ${responsavel.estado}`,
    responsavel.cep,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/motorista/vinculos"
            aria-label="Voltar"
            className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{aluno.nome}</h1>
            <p className="text-neutral-500 dark:text-neutral-400">
              {vinculo.status === "ATIVO" ? (
                <Badge variant="green">Ativo</Badge>
              ) : (
                <Badge variant="red">Revogado</Badge>
              )}
            </p>
          </div>
        </div>
        <EditarPerfilAlunoButton
          vinculoId={vinculo.id}
          nomeAluno={aluno.nome}
          inicial={{
            dataNascimento: toIsoDate(aluno.dataNascimento),
            genero: aluno.genero,
            periodo: vinculo.periodo,
            escolaId: vinculo.escolaId,
            valorMensalidade: vinculo.valorMensalidade ? Number(vinculo.valorMensalidade) : null,
            diaPagamentoMensalidade: vinculo.diaPagamentoMensalidade,
            vigenciaInicio: toIsoDate(vinculo.vigenciaInicio),
            vigenciaFim: toIsoDate(vinculo.vigenciaFim),
          }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Users className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Responsável
          </h2>
          <div className="space-y-1.5 text-sm">
            <p className="font-medium">{responsavel.nome}</p>
            <p className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
              <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {responsavel.telefone}
            </p>
            <p className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {responsavel.email}
            </p>
          </div>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70"
            >
              Falar no WhatsApp
            </a>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Endereço
          </h2>
          {enderecoCompleto ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{enderecoCompleto}</p>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              O responsável ainda não confirmou o endereço no app dele.
            </p>
          )}
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Cake className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Informações pessoais
          </h2>
          <div className="space-y-1.5 text-sm text-neutral-600 dark:text-neutral-300">
            <p>Nascimento: {aluno.dataNascimento ? formatarData(aluno.dataNascimento) : "Não informado"}</p>
            <p>Gênero: {aluno.genero ? GENERO_LABEL[aluno.genero] : "Não informado"}</p>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <GraduationCap className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Escola
          </h2>
          <div className="space-y-1.5 text-sm text-neutral-600 dark:text-neutral-300">
            <p className="flex items-center gap-1.5">
              <School className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {escola?.nome ?? "Não definida"}
            </p>
            <p>Período: {vinculo.periodo ? PERIODO_LABEL[vinculo.periodo] : "Não informado"}</p>
          </div>
        </section>
      </div>

      <section className={cardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Wallet className="h-4 w-4 text-neutral-400" aria-hidden="true" />
            Mensalidade do transporte
          </h2>
          {mensalidadesPendentes.length > 0 && (
            <Badge variant="amber">
              {mensalidadesPendentes.length} pendente{mensalidadesPendentes.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        {vinculo.valorMensalidade ? (
          <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
            {formatarValor(Number(vinculo.valorMensalidade))} por mês · todo dia {vinculo.diaPagamentoMensalidade}
            {vinculo.vigenciaInicio && ` · desde ${formatarData(vinculo.vigenciaInicio)}`}
            {vinculo.vigenciaFim && ` até ${formatarData(vinculo.vigenciaFim)}`}
          </p>
        ) : (
          <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
            Nenhuma mensalidade configurada ainda — clique em &quot;Editar perfil&quot; pra definir o valor combinado
            com a família. É dinheiro que vai direto pra você, fora da plataforma.
          </p>
        )}

        {mensalidades.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma mensalidade gerada ainda.</p>
        ) : (
          <div className="space-y-2">
            {mensalidades.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-800"
              >
                <div>
                  <p className="text-sm font-medium capitalize">{formatarMesReferencia(m.mesReferencia)}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatarValor(Number(m.valor))}
                    {m.pagoEm && ` · pago em ${formatarData(m.pagoEm)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={MENSALIDADE_STATUS_VARIANT[m.status]}>{MENSALIDADE_STATUS_LABEL[m.status]}</Badge>
                  {m.status === "PENDENTE" && <MarcarMensalidadePagaButton mensalidadeId={m.id} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <FileText className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          Contratos
        </h2>
        <ContratosSection
          vinculoId={vinculo.id}
          contratosIniciais={contratos.map((c) => ({
            id: c.id,
            titulo: c.titulo,
            observacoes: c.observacoes,
            arquivoUrl: c.arquivoUrl,
            vigenciaInicio: c.vigenciaInicio?.toISOString() ?? null,
            vigenciaFim: c.vigenciaFim?.toISOString() ?? null,
            criadoEm: c.criadoEm.toISOString(),
          }))}
        />
      </section>
    </div>
  );
}
