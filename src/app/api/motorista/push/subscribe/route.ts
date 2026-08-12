import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { pushSubscriptionSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";

/**
 * Salva (ou atualiza) a inscrição de Web Push do navegador do motorista —
 * usada pra avisar sobre eventos como convite aceito ou cobrança de aluno
 * gerada (ver src/lib/push/notificar.ts). Mesmo endpoint/lógica do
 * equivalente do responsável, só que a subscription é salva com
 * motoristaId em vez de responsavelId.
 */
export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { motoristaId: motorista.id, responsavelId: null, p256dh: keys.p256dh, auth: keys.auth },
    create: { motoristaId: motorista.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}
