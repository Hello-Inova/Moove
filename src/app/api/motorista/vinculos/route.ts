import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
    include: {
      responsavel: { select: { nome: true, email: true } },
      aluno: { select: { nome: true } },
      escola: { select: { nome: true } },
    },
  });

  return NextResponse.json(
    vinculos.map((v) => ({
      id: v.id,
      status: v.status,
      alunoNome: v.aluno.nome,
      escolaNome: v.escola?.nome ?? null,
      responsavelNome: v.responsavel.nome,
      responsavelEmail: v.responsavel.email,
      criadoEm: v.criadoEm,
      revogadoEm: v.revogadoEm,
    }))
  );
}
