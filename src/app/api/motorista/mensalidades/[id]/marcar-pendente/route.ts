import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

/**
 * Reverso de `marcar-paga` — desfaz a confirmação de recebimento, voltando a
 * mensalidade pra `PENDENTE` (sem `pagoEm`). Não existe um status
 * "ATRASADO" separado no banco: uma mensalidade `PENDENTE` já aparece como
 * atrasada em qualquer lugar que compare o vencimento com hoje (ver Painel,
 * `src/lib/painel/dashboard-data.ts`) assim que o dia de pagamento passa —
 * então "marcar como não paga" e "marcar como atrasada" são a mesma ação
 * aqui.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const mensalidade = await prisma.mensalidadeTransporte.findUnique({ where: { id } });
  if (!mensalidade || mensalidade.motoristaId !== motorista.id) {
    return jsonError(404, "Mensalidade não encontrada.");
  }

  if (mensalidade.status === "CANCELADO") {
    return jsonError(409, "Esta mensalidade foi cancelada.");
  }
  if (mensalidade.status === "PENDENTE") {
    return jsonError(409, "Esta mensalidade já está pendente.");
  }

  await prisma.mensalidadeTransporte.update({
    where: { id },
    data: { status: "PENDENTE", pagoEm: null },
  });

  return NextResponse.json({ ok: true });
}
