import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { criarConviteNominalSchema } from "@/lib/validation/schemas";
import { calcularExpiracaoConviteNominal, gerarCodigoConvite, type DadosAlunoConviteNominal } from "@/lib/convite";
import { motoristaTemAcesso, getAssinaturaAtual } from "@/lib/subscription/service";
import { sendConviteNominalEmail, EmailSendError } from "@/lib/email/mailer";
import { linkWhatsApp } from "@/lib/whatsapp";

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL não configurada.");
  return url.replace(/\/$/, "");
}

/**
 * Cria um convite NOMINAL (fluxo novo, ver plano de implantação): o
 * motorista já informa os dados do responsável, do aluno e os termos do
 * contrato; o responsável só completa o próprio cadastro, confirma o
 * endereço do aluno e assina — o vínculo é criado sozinho na assinatura
 * (ver .../convites/nominal/[codigo]/assinar). Substitui o fluxo de código
 * de compartilhamento genérico (que continua funcionando pros convites já
 * gerados, só não é mais a forma de gerar um novo).
 */
export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const assinatura = await getAssinaturaAtual(motorista.id);
  if (!motoristaTemAcesso(motorista, assinatura)) {
    return jsonError(402, "Seu período de teste acabou. Assine um plano para continuar cadastrando responsáveis.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = criarConviteNominalSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { responsavel, aluno, escolaId, periodo, valorMensalidade, diaPagamentoMensalidade, prazoMeses } = parsed.data;

  const escola = await prisma.escola.findUnique({ where: { id: escolaId } });
  if (!escola || escola.motoristaId !== motorista.id) {
    return jsonError(400, "Escola inválida.");
  }

  // MVP: só cobre o caso do responsável ainda não ter conta no Moove — quem
  // já tem conta consegue se vincular pelo fluxo de código normal (o
  // responsável já sabe usar "Meus alunos"). Ver plano de implantação.
  const contaExistente = await prisma.responsavel.findUnique({ where: { email: responsavel.email } });
  if (contaExistente) {
    return jsonError(
      409,
      "Esse e-mail já tem uma conta no Moove. Peça pra essa pessoa entrar e usar um código de convite normal pra vincular o aluno."
    );
  }

  const dadosAluno: DadosAlunoConviteNominal = {
    nomeAluno: aluno.nome,
    escolaId,
    periodo: periodo ?? null,
    valorMensalidade: valorMensalidade ?? null,
    diaPagamentoMensalidade: diaPagamentoMensalidade ?? null,
    prazoMeses: prazoMeses ?? null,
  };

  let convite = null;
  for (let attempt = 0; attempt < 5 && !convite; attempt++) {
    try {
      convite = await prisma.convite.create({
        data: {
          codigo: gerarCodigoConvite(),
          motoristaId: motorista.id,
          tipo: "NOMINAL",
          expiraEm: calcularExpiracaoConviteNominal(),
          nomeResponsavel: responsavel.nome,
          emailResponsavel: responsavel.email,
          telefoneResponsavel: responsavel.telefone,
          cpfResponsavel: responsavel.cpf,
          dadosAluno,
        },
      });
    } catch {
      // colisão de código único — tenta de novo
    }
  }
  if (!convite) return jsonError(500, "Não foi possível gerar o convite. Tente novamente.");

  const link = `${getAppUrl()}/responsavel/convite/${convite.codigo}`;

  try {
    await sendConviteNominalEmail({
      to: responsavel.email,
      nomeResponsavel: responsavel.nome,
      nomeMotorista: motorista.nome,
      nomeAluno: aluno.nome,
      link,
    });
  } catch (err) {
    // Não desfaz o convite por falha de e-mail — o motorista ainda pode
    // mandar o link manualmente (mostrado na resposta) ou pelo WhatsApp.
    if (!(err instanceof EmailSendError)) throw err;
  }

  const waLink = linkWhatsApp(
    responsavel.telefone,
    `Olá, ${responsavel.nome}! Preparei o contrato de transporte escolar de ${aluno.nome} no Moove. Complete seu cadastro e assine por aqui: ${link}`
  );

  return NextResponse.json(
    {
      id: convite.id,
      codigo: convite.codigo,
      link,
      waLink,
      expiraEm: convite.expiraEm,
    },
    { status: 201 }
  );
}
