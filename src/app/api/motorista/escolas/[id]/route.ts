import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const escola = await prisma.escola.findUnique({ where: { id } });
  if (!escola || escola.motoristaId !== motorista.id) {
    return jsonError(404, "Escola não encontrada.");
  }

  const emUso = await prisma.vinculo.findFirst({ where: { escolaId: id, status: "ATIVO" } });
  if (emUso) {
    return jsonError(409, "Esta escola tem alunos vinculados nela — não é possível excluir.");
  }

  await prisma.escola.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
