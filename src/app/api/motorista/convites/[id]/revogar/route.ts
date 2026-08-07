import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const convite = await prisma.convite.findUnique({ where: { id } });
  if (!convite || convite.motoristaId !== motorista.id) {
    return jsonError(404, "Convite não encontrado.");
  }

  if (convite.status !== "PENDENTE") {
    return jsonError(409, "Apenas convites pendentes podem ser revogados.");
  }

  await prisma.convite.update({ where: { id }, data: { status: "REVOGADO" } });

  return NextResponse.json({ ok: true });
}
