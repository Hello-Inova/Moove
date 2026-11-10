import { NextRequest, NextResponse } from "next/server";

import {
  createSession,
  getMotoristaIdFromCheckoutReturnToken,
} from "@/lib/auth/session";

/**
 * A Asaas volta de outro domínio e alguns navegadores não reenviam a sessão
 * original. Este endpoint recebe um token curto e assinado, restaura a sessão
 * do próprio motorista e segue para a tela de Planos com a confirmação.
 */
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const motoristaId = state ? await getMotoristaIdFromCheckoutReturnToken(state) : null;

  if (!motoristaId) {
    return NextResponse.redirect(new URL("/motorista/login", request.url));
  }

  await createSession("motorista", motoristaId);

  const response = NextResponse.redirect(
    new URL("/motorista/planos?pagamento=sucesso", request.url)
  );
  // Evita que o token temporário apareça como referrer em recursos seguintes.
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
