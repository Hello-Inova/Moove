import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

/**
 * Exclui o veículo — único jeito de "trocar" de veículo hoje, já que cada
 * motorista só pode ter 1 cadastrado por vez (ver validação no POST
 * /api/motorista/veiculos). Não há vínculo de outra tabela pelo id do
 * veículo (percurso/localização usam motoristaId + placa em texto), então
 * a exclusão é direta, sem checagem de "em uso".
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const veiculo = await prisma.veiculo.findUnique({ where: { id } });
  if (!veiculo || veiculo.motoristaId !== motorista.id) {
    return jsonError(404, "Veículo não encontrado.");
  }

  await prisma.veiculo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
