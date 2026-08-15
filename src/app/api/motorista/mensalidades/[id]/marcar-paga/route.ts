import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

/**
 * Mensalidade do transporte é combinada direto entre motorista e
 * responsável, fora da plataforma (ver comentário no schema, model
 * MensalidadeTransporte) — essa rota só registra que o motorista confirmou
 * o recebimento manualmente, mesmo padrão que já existia pra CobrancaAluno
 * antes dela passar a usar Asaas.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const mensalidade = await prisma.mensalidadeTransporte.findUnique({ where: { id } });
  if (!mensalidade || mensalidade.motoristaId !== motorista.id) {
    return jsonError(404, "Mensalidade não encontrada.");
  }

  if (mensalidade.status === "PAGO") {
    return jsonError(409, "Esta mensalidade já está marcada como paga.");
  }
  if (mensalidade.status === "CANCELADO") {
    return jsonError(409, "Esta mensalidade foi cancelada.");
  }

  await prisma.mensalidadeTransporte.update({
    where: { id },
    data: { status: "PAGO", pagoEm: new Date() },
  });

  return NextResponse.json({ ok: true });
}
