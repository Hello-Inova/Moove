import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

/**
 * Cobrança por aluno é combinada diretamente entre motorista e responsável
 * via PIX (ver CobrancaAluno) — a plataforma não processa esse pagamento,
 * só ajuda a cobrar (ver WhatsAppCobrancaButton.tsx). Essa rota só registra
 * que o motorista confirmou o recebimento manualmente.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const cobranca = await prisma.cobrancaAluno.findUnique({ where: { id } });
  if (!cobranca || cobranca.motoristaId !== motorista.id) {
    return jsonError(404, "Cobrança não encontrada.");
  }

  if (cobranca.status === "PAGO") {
    return jsonError(409, "Esta cobrança já está marcada como paga.");
  }
  if (cobranca.status === "CANCELADO") {
    return jsonError(409, "Esta cobrança foi cancelada.");
  }

  await prisma.cobrancaAluno.update({
    where: { id },
    data: { status: "PAGO", pagoEm: new Date() },
  });

  return NextResponse.json({ ok: true });
}
