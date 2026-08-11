import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError, jsonRateLimited } from "@/lib/http";
import { issueVerificationCode, EmailSendError, ResendCooldownError } from "@/lib/email/verification";
import { aplicarRateLimitLogin, clientIp } from "@/lib/rate-limit";

/**
 * Primeira etapa do login: valida e-mail+senha e, se ok, envia um código de
 * verificação por e-mail — a sessão só é criada em
 * POST /api/auth/motorista/login/verificar depois do código confirmado.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, senha } = parsed.data;

  // Limite por e-mail (protege UMA conta de força bruta de senha) e por IP
  // (protege contra alguém testando várias contas em sequência).
  const rateLimit = await aplicarRateLimitLogin({
    escopo: "login:motorista",
    identificador: email,
    ip: clientIp(request),
    porIdentificador: { max: 8, janelaMinutos: 15 },
    porIp: { max: 20, janelaMinutos: 15 },
  });
  if (!rateLimit.ok) return jsonRateLimited(rateLimit.retryAfterSegundos);

  const motorista = await prisma.motorista.findUnique({ where: { email } });
  const senhaOk = motorista ? await verifyPassword(senha, motorista.senhaHash) : false;

  // Mensagem genérica: não revelar se o e-mail existe ou não.
  if (!motorista || !senhaOk) {
    return jsonError(401, "E-mail ou senha inválidos.");
  }

  if (motorista.statusConta !== "ATIVA") {
    return jsonError(403, "Conta inativa. Entre em contato com o suporte.");
  }

  try {
    await issueVerificationCode({ email, role: "motorista", proposito: "LOGIN", nome: motorista.nome });
  } catch (err) {
    if (err instanceof ResendCooldownError) return jsonError(429, err.message);
    if (err instanceof EmailSendError) {
      return jsonError(502, "Não foi possível enviar o e-mail de verificação agora. Tente novamente em instantes.");
    }
    throw err;
  }

  return NextResponse.json({ email });
}
