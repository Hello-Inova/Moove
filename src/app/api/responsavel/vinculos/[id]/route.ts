import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

/**
 * Detalhe de um vínculo pro lado do responsável (Fase 5 do plano de
 * implantação — "portal do responsável": histórico de mensalidade e
 * contrato, hoje só visível pro motorista em /motorista/vinculos/[id]).
 * Somente leitura — toda edição (mensalidade, período, vigência) continua
 * exclusiva do motorista.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const vinculo = await prisma.vinculo.findUnique({
    where: { id },
    include: {
      motorista: { select: { nome: true, telefone: true, chavePix: true } },
      aluno: { select: { nome: true } },
      escola: { select: { nome: true } },
      mensalidades: { orderBy: { mesReferencia: "desc" } },
      contratos: { orderBy: { criadoEm: "desc" } },
    },
  });

  // Isolamento: só o responsável dono do vínculo pode ver — nunca expõe
  // dados de outra família, mesmo com o id certo na URL.
  if (!vinculo || vinculo.responsavelId !== responsavel.id) {
    return jsonError(404, "Vínculo não encontrado.");
  }

  return NextResponse.json({
    id: vinculo.id,
    status: vinculo.status,
    alunoNome: vinculo.aluno.nome,
    escolaNome: vinculo.escola?.nome ?? null,
    periodo: vinculo.periodo,
    motorista: {
      nome: vinculo.motorista.nome,
      telefone: vinculo.motorista.telefone,
      chavePix: vinculo.motorista.chavePix,
    },
    mensalidade: {
      valor: vinculo.valorMensalidade ? Number(vinculo.valorMensalidade) : null,
      diaPagamento: vinculo.diaPagamentoMensalidade,
      vigenciaInicio: vinculo.vigenciaInicio,
      vigenciaFim: vinculo.vigenciaFim,
    },
    mensalidades: vinculo.mensalidades.map((m) => ({
      id: m.id,
      mesReferencia: m.mesReferencia,
      valor: Number(m.valor),
      status: m.status,
      pagoEm: m.pagoEm,
    })),
    contratos: vinculo.contratos.map((c) => ({
      id: c.id,
      titulo: c.titulo,
      textoContrato: c.textoContrato,
      arquivoUrl: c.arquivoUrl,
      prazoMeses: c.prazoMeses,
      vigenciaInicio: c.vigenciaInicio,
      vigenciaFim: c.vigenciaFim,
      assinadoEm: c.assinadoEm,
      criadoEm: c.criadoEm,
    })),
  });
}
