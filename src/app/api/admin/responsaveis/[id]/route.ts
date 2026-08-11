import { NextRequest, NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit-log";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const responsavel = await prisma.responsavel.findUnique({ where: { id } });
  if (!responsavel) return jsonError(404, "Responsável não encontrado.");

  // Vínculos e convites-usados-por têm onDelete: Cascade / o vínculo some
  // junto; apagar o responsável já limpa o que está ligado a ele.
  await prisma.responsavel.delete({ where: { id } });

  await registrarAuditoria({
    acao: "EXCLUIR_RESPONSAVEL",
    entidade: "Responsavel",
    entidadeId: id,
    detalhes: { nome: responsavel.nome, email: responsavel.email },
    request,
  });

  return NextResponse.json({ ok: true });
}
