import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { alertaChegadaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  return NextResponse.json({ alertaChegadaMinutos: motorista.alertaChegadaMinutos });
}

/**
 * Minutos de antecedência (estimados) do alerta sonoro de chegada — usado
 * em POST /api/motorista/localizacao pra decidir quando avisar o
 * responsável.
 */
export async function PATCH(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = alertaChegadaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  await prisma.motorista.update({
    where: { id: motorista.id },
    data: { alertaChegadaMinutos: parsed.data.alertaChegadaMinutos },
  });

  return NextResponse.json({ ok: true });
}
