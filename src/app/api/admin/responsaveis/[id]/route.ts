import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const responsavel = await prisma.responsavel.findUnique({ where: { id } });
  if (!responsavel) return jsonError(404, "Responsável não encontrado.");

  // Vínculos e convites-usados-por têm onDelete: Cascade / o vínculo some
  // junto; apagar o responsável já limpa o que está ligado a ele.
  await prisma.responsavel.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
