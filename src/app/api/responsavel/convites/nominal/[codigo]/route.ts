import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import type { DadosAlunoConviteNominal } from "@/lib/convite";

/**
 * Consulta pública (sem sessão) do convite nominal — é a página que abre
 * direto do link do e-mail/WhatsApp, antes de qualquer login. Só devolve o
 * necessário pra pré-preencher o formulário; nunca expõe dados de outros
 * convites/motoristas.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  const convite = await prisma.convite.findUnique({
    where: { codigo: codigo.toUpperCase() },
    include: {
      motorista: { select: { nome: true } },
    },
  });

  if (!convite || convite.tipo !== "NOMINAL") {
    return jsonError(404, "Convite não encontrado.");
  }
  if (convite.status === "PENDENTE" && convite.expiraEm.getTime() < Date.now()) {
    return jsonError(410, "Este convite expirou. Peça pro motorista gerar um novo.");
  }
  if (convite.status === "USADO") {
    return jsonError(409, "Este convite já foi usado.");
  }
  if (convite.status !== "PENDENTE") {
    return jsonError(409, "Este convite não está mais disponível.");
  }

  const dadosAluno = convite.dadosAluno as unknown as DadosAlunoConviteNominal | null;
  if (!dadosAluno) return jsonError(500, "Convite com dados incompletos.");

  const escola = await prisma.escola.findUnique({ where: { id: dadosAluno.escolaId }, select: { nome: true } });

  return NextResponse.json({
    motoristaNome: convite.motorista.nome,
    // Já criado (passo "cadastrar/verificar" concluído) — o cliente pula
    // direto pra etapa de endereço/assinatura em vez de pedir senha de novo.
    contaJaCriada: Boolean(convite.alunoIdNominal),
    alunoId: convite.alunoIdNominal,
    responsavel: {
      nome: convite.nomeResponsavel,
      email: convite.emailResponsavel,
      telefone: convite.telefoneResponsavel,
      cpf: convite.cpfResponsavel,
    },
    aluno: { nome: dadosAluno.nomeAluno },
    escolaNome: escola?.nome ?? null,
    periodo: dadosAluno.periodo,
    valorMensalidade: dadosAluno.valorMensalidade,
    diaPagamentoMensalidade: dadosAluno.diaPagamentoMensalidade,
    prazoMeses: dadosAluno.prazoMeses,
  });
}
