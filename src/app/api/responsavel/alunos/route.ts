import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { alunoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const alunos = await prisma.aluno.findMany({
    where: { responsavelId: responsavel.id },
    orderBy: { criadoEm: "asc" },
    include: {
      vinculos: {
        where: { status: "ATIVO" },
        include: { motorista: { select: { nome: true } }, escola: { select: { nome: true } } },
        take: 1,
      },
    },
  });

  return NextResponse.json(
    alunos.map((a) => {
      const vinculoAtivo = a.vinculos[0] ?? null;
      return {
        id: a.id,
        nome: a.nome,
        vinculado: vinculoAtivo !== null,
        motoristaNome: vinculoAtivo?.motorista.nome ?? null,
        escolaNome: vinculoAtivo?.escola?.nome ?? null,
      };
    })
  );
}

/**
 * Cadastro do aluno é livre (não exige assinatura paga) — a cobrança entra
 * só na hora de vincular a um motorista (ver /api/responsavel/assinatura e
 * /api/responsavel/convites/usar). Isso permite ao responsável montar a
 * lista de filhos antes de decidir/pagar o plano.
 */
export async function POST(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = alunoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const aluno = await prisma.aluno.create({
    data: { responsavelId: responsavel.id, nome: parsed.data.nome },
  });

  return NextResponse.json({ id: aluno.id, nome: aluno.nome, vinculado: false }, { status: 201 });
}
