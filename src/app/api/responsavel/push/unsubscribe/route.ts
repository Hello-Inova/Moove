import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { pushUnsubscribeSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = pushUnsubscribeSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, responsavelId: responsavel.id },
  });

  return NextResponse.json({ ok: true });
}
