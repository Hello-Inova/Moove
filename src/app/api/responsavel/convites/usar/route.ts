import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { usarConviteSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { adicionarDias } from "@/lib/subscription/cobranca-aluno";
import { notificarPush } from "@/lib/push/notificar";

export async function POST(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = usarConviteSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { codigo, alunoId, escolaId } = parsed.data;

  const convite = await prisma.convite.findUnique({ where: { codigo } });
  if (!convite) return jsonError(404, "Código de convite inválido.");

  if (convite.status === "PENDENTE" && convite.expiraEm.getTime() < Date.now()) {
    await prisma.convite.update({ where: { id: convite.id }, data: { status: "EXPIRADO" } });
    return jsonError(410, "Este código de convite expirou.");
  }

  if (convite.status !== "PENDENTE") {
    const motivo =
      convite.status === "USADO"
        ? "Este código já foi utilizado."
        : convite.status === "REVOGADO"
          ? "Este código foi revogado pelo motorista."
          : "Este código expirou.";
    return jsonError(409, motivo);
  }

  // O responsável não paga mais pra vincular alunos (quem paga por aluno
  // agora é o motorista, ver CobrancaAluno) — sem checagem de vagas/assinatura
  // aqui.
  const aluno = await prisma.aluno.findUnique({ where: { id: alunoId } });
  if (!aluno || aluno.responsavelId !== responsavel.id) {
    return jsonError(404, "Aluno não encontrado.");
  }

  const vinculoAtivoDoAluno = await prisma.vinculo.findFirst({ where: { alunoId, status: "ATIVO" } });
  if (vinculoAtivoDoAluno) {
    return jsonError(409, "Este aluno já está vinculado a um motorista.");
  }

  const escola = await prisma.escola.findUnique({ where: { id: escolaId } });
  if (!escola || escola.motoristaId !== convite.motoristaId) {
    return jsonError(404, "Escola inválida para este motorista.");
  }

  try {
    const vinculo = await prisma.$transaction(async (tx) => {
      // Revalida o status dentro da transação para evitar corrida entre duas
      // requisições concorrentes tentando resgatar o mesmo código.
      const atualizado = await tx.convite.updateMany({
        where: { id: convite.id, status: "PENDENTE" },
        data: {
          status: "USADO",
          usadoPorResponsavelId: responsavel.id,
          usadoEm: new Date(),
        },
      });

      if (atualizado.count === 0) {
        throw new Error("CONVITE_JA_USADO");
      }

      return tx.vinculo.create({
        data: {
          motoristaId: convite.motoristaId,
          responsavelId: responsavel.id,
          alunoId,
          escolaId,
          conviteId: convite.id,
          // Primeiro "corte" de cobrança por aluno em 30 dias — ver
          // src/lib/subscription/cobranca-aluno.ts.
          proximaCobrancaEm: adicionarDias(new Date(), 30),
        },
        include: { motorista: { select: { nome: true } } },
      });
    });

    await notificarPush(
      { motoristaId: convite.motoristaId },
      {
        title: "Novo aluno vinculado",
        body: `${responsavel.nome} vinculou ${aluno.nome} usando seu convite.`,
        tag: `convite-aceito-${vinculo.id}`,
      }
    );

    return NextResponse.json(
      {
        id: vinculo.id,
        motoristaNome: vinculo.motorista.nome,
        status: vinculo.status,
        criadoEm: vinculo.criadoEm,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "CONVITE_JA_USADO") {
      return jsonError(409, "Este código já foi utilizado.");
    }
    throw err;
  }
}
