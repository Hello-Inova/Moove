import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { pushSubscriptionSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";

/**
 * Salva (ou atualiza) a inscrição de Web Push do navegador do responsável —
 * é isso que permite o servidor mandar o alerta sonoro de proximidade
 * mesmo com a aba em segundo plano. Ver PushSubscribeButton.tsx (cliente)
 * e src/lib/push/webpush.ts (envio).
 */
export async function POST(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { responsavelId: responsavel.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { responsavelId: responsavel.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true });
}
