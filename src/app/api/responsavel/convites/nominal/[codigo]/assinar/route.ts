import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { assinarContratoNominalSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { adicionarDias } from "@/lib/subscription/cobranca-aluno";
import { notificarPush } from "@/lib/push/notificar";
import { gerarTextoContrato, hashTexto } from "@/lib/contrato-transporte";
import type { DadosAlunoConviteNominal } from "@/lib/convite";
import { clientIp } from "@/lib/rate-limit";

function primeiroDiaDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

function somarMeses(data: Date, meses: number): Date {
  return new Date(data.getFullYear(), data.getMonth() + meses, 1);
}

/**
 * Passo final do convite nominal: o responsável já está autenticado (conta
 * e Aluno criados em .../verificar) e só confirma o aceite do contrato.
 * Cria o Vinculo + ContratoTransporte (com o snapshot assinado) e marca o
 * convite como USADO — tudo numa transação, "vínculo automático" do plano
 * de implantação (sem código pra digitar).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const { codigo } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = assinarContratoNominalSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const convite = await prisma.convite.findUnique({
    where: { codigo: codigo.toUpperCase() },
    include: { motorista: { select: { id: true, nome: true } } },
  });

  if (!convite || convite.tipo !== "NOMINAL" || convite.status !== "PENDENTE") {
    return jsonError(409, "Este convite não está mais disponível.");
  }
  if (convite.expiraEm.getTime() < Date.now()) {
    return jsonError(410, "Este convite expirou. Peça pro motorista gerar um novo.");
  }
  if (!convite.alunoIdNominal) {
    return jsonError(409, "Complete o cadastro antes de assinar o contrato.");
  }

  const aluno = await prisma.aluno.findUnique({ where: { id: convite.alunoIdNominal } });
  if (!aluno || aluno.responsavelId !== responsavel.id) {
    return jsonError(403, "Este convite não pertence à sua conta.");
  }

  const dadosAluno = convite.dadosAluno as unknown as DadosAlunoConviteNominal | null;
  if (!dadosAluno) return jsonError(500, "Convite com dados incompletos.");

  const escola = await prisma.escola.findUnique({ where: { id: dadosAluno.escolaId } });
  if (!escola || escola.motoristaId !== convite.motoristaId) {
    return jsonError(400, "Escola inválida para este motorista.");
  }

  const vigenciaInicio = primeiroDiaDoMes(new Date());
  const vigenciaFim = dadosAluno.prazoMeses ? somarMeses(vigenciaInicio, dadosAluno.prazoMeses) : null;

  const textoContrato = gerarTextoContrato({
    nomeMotorista: convite.motorista.nome,
    nomeResponsavel: responsavel.nome,
    cpfResponsavel: responsavel.cpf ?? "não informado",
    nomeAluno: aluno.nome,
    escolaNome: escola.nome,
    valorMensalidade: dadosAluno.valorMensalidade,
    diaPagamentoMensalidade: dadosAluno.diaPagamentoMensalidade,
    prazoMeses: dadosAluno.prazoMeses,
    vigenciaInicio,
    vigenciaFim,
  });

  try {
    const vinculo = await prisma.$transaction(async (tx) => {
      const atualizado = await tx.convite.updateMany({
        where: { id: convite.id, status: "PENDENTE" },
        data: { status: "USADO", usadoPorResponsavelId: responsavel.id, usadoEm: new Date() },
      });
      if (atualizado.count === 0) throw new Error("CONVITE_JA_USADO");

      const vinculo = await tx.vinculo.create({
        data: {
          motoristaId: convite.motoristaId,
          responsavelId: responsavel.id,
          alunoId: aluno.id,
          escolaId: escola.id,
          conviteId: convite.id,
          periodo: dadosAluno.periodo,
          valorMensalidade: dadosAluno.valorMensalidade,
          diaPagamentoMensalidade: dadosAluno.diaPagamentoMensalidade,
          vigenciaInicio,
          vigenciaFim,
          proximaCobrancaEm: adicionarDias(new Date(), 30),
        },
      });

      await tx.contratoTransporte.create({
        data: {
          vinculoId: vinculo.id,
          titulo: `Contrato de transporte escolar — ${aluno.nome}`,
          vigenciaInicio,
          vigenciaFim,
          prazoMeses: dadosAluno.prazoMeses,
          textoContrato,
          assinadoEm: new Date(),
          assinadoIp: clientIp(request),
          assinadoUserAgent: request.headers.get("user-agent"),
          assinadoHash: hashTexto(textoContrato),
        },
      });

      return vinculo;
    });

    await notificarPush(
      { motoristaId: convite.motoristaId },
      {
        title: "Contrato assinado",
        body: `${responsavel.nome} completou o cadastro e assinou o contrato de ${aluno.nome}.`,
        tag: `convite-nominal-assinado-${vinculo.id}`,
      }
    );

    return NextResponse.json({ vinculoId: vinculo.id, motoristaNome: convite.motorista.nome }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "CONVITE_JA_USADO") {
      return jsonError(409, "Este convite já foi usado.");
    }
    throw err;
  }
}
