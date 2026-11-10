import { NextRequest, NextResponse } from "next/server";

import { createSession, getPagamentoIdFromCheckoutReturnState } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * A Asaas volta de outro domínio e alguns navegadores não reenviam a sessão
 * original. O estado curto identifica uma tentativa de pagamento e tem HMAC,
 * permitindo restaurar exclusivamente a sessão do motorista dono dela.
 */
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const pagamentoId = state ? getPagamentoIdFromCheckoutReturnState(state) : null;

  const pagamento = pagamentoId
    ? await prisma.pagamento.findUnique({
        where: { id: pagamentoId },
        include: { assinatura: { select: { motoristaId: true } } },
      })
    : null;
  const motoristaId = pagamento?.assinatura?.motoristaId ?? null;

  if (!motoristaId) {
    return NextResponse.redirect(new URL("/motorista/login", request.url));
  }

  await createSession("motorista", motoristaId);

  const response = NextResponse.redirect(
    new URL("/motorista/planos?pagamento=sucesso", request.url)
  );
  // Evita que o identificador temporário apareça como referrer em recursos seguintes.
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
