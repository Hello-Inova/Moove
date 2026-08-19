import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { editarPerfilAlunoSchema } from "@/lib/validation/schemas";
import { sincronizarMensalidadesVigencia } from "@/lib/mensalidade/mensalidade-transporte";

/**
 * Atualiza o perfil de um aluno vinculado — dados pessoais (nascimento,
 * gênero, no model Aluno) e dados escolares/de pagamento (período, escola,
 * termos da mensalidade do transporte, no model Vinculo). Usada pelo
 * assistente de edição na tela de perfil do aluno
 * (/motorista/vinculos/[id]). Todos os campos são opcionais — a mesma rota
 * aceita salvar qualquer etapa do assistente isoladamente.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const vinculo = await prisma.vinculo.findUnique({ where: { id } });
  if (!vinculo || vinculo.motoristaId !== motorista.id) {
    return jsonError(404, "Vínculo não encontrado.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = editarPerfilAlunoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const {
    dataNascimento,
    genero,
    periodo,
    escolaId,
    valorMensalidade,
    diaPagamentoMensalidade,
    vigenciaInicio,
    vigenciaFim,
  } = parsed.data;

  if (escolaId) {
    const escola = await prisma.escola.findUnique({ where: { id: escolaId } });
    if (!escola || escola.motoristaId !== motorista.id) {
      return jsonError(400, "Escola inválida.");
    }
  }

  try {
    await prisma.$transaction([
      prisma.aluno.update({
        where: { id: vinculo.alunoId },
        data: {
          ...(dataNascimento !== undefined && { dataNascimento }),
          ...(genero !== undefined && { genero }),
        },
      }),
      prisma.vinculo.update({
        where: { id },
        data: {
          ...(periodo !== undefined && { periodo }),
          ...(escolaId !== undefined && { escolaId: escolaId || null }),
          ...(valorMensalidade !== undefined && { valorMensalidade }),
          ...(diaPagamentoMensalidade !== undefined && { diaPagamentoMensalidade }),
          ...(vigenciaInicio !== undefined && { vigenciaInicio }),
          ...(vigenciaFim !== undefined && { vigenciaFim }),
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError(400, "Não foi possível salvar — confira os dados informados.");
    }
    throw err;
  }

  // Item 13 do pedido: qualquer edição que mexa na vigência ou nos termos
  // de pagamento já reflete de imediato no Painel, inclusive retroativo
  // (mês passado que entrou na vigência) — não espera o próximo corte do
  // cron (ver comentário em sincronizarMensalidadesVigencia).
  if (
    valorMensalidade !== undefined ||
    diaPagamentoMensalidade !== undefined ||
    vigenciaInicio !== undefined ||
    vigenciaFim !== undefined
  ) {
    await sincronizarMensalidadesVigencia(id);
  }

  return NextResponse.json({ ok: true });
}
