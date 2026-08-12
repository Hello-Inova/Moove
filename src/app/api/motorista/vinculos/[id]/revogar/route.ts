import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { notificarPush } from "@/lib/push/notificar";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const vinculo = await prisma.vinculo.findUnique({
    where: { id },
    include: { aluno: { select: { nome: true } } },
  });
  if (!vinculo || vinculo.motoristaId !== motorista.id) {
    return jsonError(404, "Vínculo não encontrado.");
  }

  if (vinculo.status !== "ATIVO") {
    return jsonError(409, "Este vínculo já está revogado.");
  }

  // A revogação bloqueia imediatamente o acesso do responsável à localização:
  // toda checagem de acesso consulta status === 'ATIVO' em tempo real, sem
  // cache, então o próximo polling do responsável já é negado.
  await prisma.vinculo.update({
    where: { id },
    data: { status: "REVOGADO", revogadoEm: new Date() },
  });

  await notificarPush(
    { responsavelId: vinculo.responsavelId },
    {
      title: "Vínculo revogado",
      body: `${motorista.nome} revogou o vínculo com ${vinculo.aluno.nome}. Você perdeu acesso à localização.`,
      tag: `vinculo-revogado-${vinculo.id}`,
    }
  );

  return NextResponse.json({ ok: true });
}
