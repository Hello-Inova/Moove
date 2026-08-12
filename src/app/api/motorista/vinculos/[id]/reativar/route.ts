import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { adicionarDias } from "@/lib/subscription/cobranca-aluno";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const vinculo = await prisma.vinculo.findUnique({ where: { id } });
  if (!vinculo || vinculo.motoristaId !== motorista.id) {
    return jsonError(404, "Vínculo não encontrado.");
  }

  if (vinculo.status !== "REVOGADO") {
    return jsonError(409, "Este vínculo já está ativo.");
  }

  // Um aluno só pode ter um vínculo ATIVO por vez — se ele foi vinculado a
  // outro motorista enquanto este vínculo estava revogado, não dá pra
  // reativar aqui (evita dois motoristas "ativos" pro mesmo aluno).
  const vinculoAtivoDoAluno = await prisma.vinculo.findFirst({
    where: { alunoId: vinculo.alunoId, status: "ATIVO" },
  });
  if (vinculoAtivoDoAluno) {
    return jsonError(409, "Este aluno já está vinculado a outro motorista.");
  }

  // Reativar reinicia o relógio de cobrança — novo corte de 30 dias a partir
  // de agora (ver src/lib/subscription/cobranca-aluno.ts), pra não cobrar
  // retroativo pelo período em que o vínculo esteve revogado.
  await prisma.vinculo.update({
    where: { id },
    data: { status: "ATIVO", revogadoEm: null, proximaCobrancaEm: adicionarDias(new Date(), 30) },
  });

  return NextResponse.json({ ok: true });
}
