import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const contrato = await prisma.contratoTransporte.findUnique({
    where: { id },
    include: { vinculo: { select: { motoristaId: true } } },
  });
  if (!contrato || contrato.vinculo.motoristaId !== motorista.id) {
    return jsonError(404, "Contrato não encontrado.");
  }

  await prisma.contratoTransporte.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
