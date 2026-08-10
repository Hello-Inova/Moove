import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const aluno = await prisma.aluno.findUnique({ where: { id } });
  if (!aluno || aluno.responsavelId !== responsavel.id) {
    return jsonError(404, "Aluno não encontrado.");
  }

  const vinculoAtivo = await prisma.vinculo.findFirst({ where: { alunoId: id, status: "ATIVO" } });
  if (vinculoAtivo) {
    return jsonError(409, "Este aluno está vinculado a um motorista — revogue o vínculo antes de excluir.");
  }

  await prisma.aluno.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
