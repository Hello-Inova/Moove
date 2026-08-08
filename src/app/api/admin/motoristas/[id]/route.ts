import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const motorista = await prisma.motorista.findUnique({ where: { id } });
  if (!motorista) return jsonError(404, "Motorista não encontrado.");

  // Todas as tabelas relacionadas (veículos, convites, vínculos, localização,
  // assinaturas/pagamentos) têm onDelete: Cascade — apagar o motorista já
  // limpa tudo ligado a ele.
  await prisma.motorista.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
