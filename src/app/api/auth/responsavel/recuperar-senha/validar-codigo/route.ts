import { NextRequest, NextResponse } from "next/server";

import { verificarCodigoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError, jsonRateLimited } from "@/lib/http";
import { peekCode } from "@/lib/email/verification";
import { aplicarRateLimitLogin, clientIp } from "@/lib/rate-limit";

/**
 * Etapa intermediária da recuperação de senha: só confere se o código bate,
 * sem consumi-lo (ver `peekCode`) — usada pra só então liberar os campos de
 * nova senha na tela (ver RecuperarSenhaForm.tsx). O código só é de fato
 * consumido depois, em /confirmar, junto com a troca de senha de verdade.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = verificarCodigoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, codigo } = parsed.data;

  const rateLimit = await aplicarRateLimitLogin({
    escopo: "recuperar-senha:responsavel:validar-codigo",
    identificador: email,
    ip: clientIp(request),
    porIdentificador: { max: 10, janelaMinutos: 15 },
    porIp: { max: 30, janelaMinutos: 15 },
  });
  if (!rateLimit.ok) return jsonRateLimited(rateLimit.retryAfterSegundos);

  const resultado = await peekCode({ email, role: "responsavel", proposito: "RECUPERAR_SENHA", codigo });
  if (!resultado.ok) return jsonError(400, resultado.error);

  return NextResponse.json({ email });
}
