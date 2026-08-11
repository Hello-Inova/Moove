import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { recuperarSenhaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError, jsonRateLimited } from "@/lib/http";
import { issueVerificationCode, EmailSendError, ResendCooldownError } from "@/lib/email/verification";
import { aplicarRateLimitLogin, clientIp } from "@/lib/rate-limit";

/**
 * Primeira etapa da recuperação de senha: envia um código de verificação
 * por e-mail para a conta informada. O mesmo endpoint serve para reenviar o
 * código (o cooldown de reenvio já é tratado por issueVerificationCode). A
 * senha só é trocada em POST .../recuperar-senha/confirmar, depois do
 * código validado.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = recuperarSenhaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email } = parsed.data;

  const rateLimit = await aplicarRateLimitLogin({
    escopo: "recuperar-senha:responsavel",
    identificador: email,
    ip: clientIp(request),
    porIdentificador: { max: 5, janelaMinutos: 15 },
    porIp: { max: 20, janelaMinutos: 15 },
  });
  if (!rateLimit.ok) return jsonRateLimited(rateLimit.retryAfterSegundos);

  const responsavel = await prisma.responsavel.findUnique({ where: { email } });
  if (!responsavel) {
    return jsonError(404, "Nenhuma conta de responsável encontrada com esse e-mail.");
  }

  try {
    await issueVerificationCode({
      email,
      role: "responsavel",
      proposito: "RECUPERAR_SENHA",
      nome: responsavel.nome,
    });
  } catch (err) {
    if (err instanceof ResendCooldownError) return jsonError(429, err.message);
    if (err instanceof EmailSendError) {
      return jsonError(502, "Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
    }
    throw err;
  }

  return NextResponse.json({ email });
}
