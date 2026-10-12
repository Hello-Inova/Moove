import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/schemas";
import { jsonError, jsonRateLimited, jsonValidationError } from "@/lib/http";
import { aplicarRateLimitLogin, clientIp } from "@/lib/rate-limit";
import { EmailSendError, issueVerificationCode, ResendCooldownError } from "@/lib/email/verification";

/** Login público único. A senha determina o perfil antes do envio do segundo fator. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, senha } = parsed.data;
  const rateLimit = await aplicarRateLimitLogin({
    escopo: "login:unificado",
    identificador: email,
    ip: clientIp(request),
    porIdentificador: { max: 8, janelaMinutos: 15 },
    porIp: { max: 20, janelaMinutos: 15 },
  });
  if (!rateLimit.ok) return jsonRateLimited(rateLimit.retryAfterSegundos);

  const [motorista, responsavel] = await Promise.all([
    prisma.motorista.findUnique({ where: { email } }),
    prisma.responsavel.findUnique({ where: { email } }),
  ]);
  const [senhaMotoristaOk, senhaResponsavelOk] = await Promise.all([
    motorista ? verifyPassword(senha, motorista.senhaHash) : false,
    responsavel ? verifyPassword(senha, responsavel.senhaHash) : false,
  ]);

  if (
    (senhaMotoristaOk && motorista?.statusConta !== "ATIVA") ||
    (senhaResponsavelOk && responsavel?.statusConta !== "ATIVA")
  ) {
    return jsonError(403, "Conta inativa. Entre em contato com o suporte.");
  }

  const role =
    senhaMotoristaOk && motorista?.statusConta === "ATIVA"
      ? "motorista"
      : senhaResponsavelOk && responsavel?.statusConta === "ATIVA"
        ? "responsavel"
        : null;
  if (!role) return jsonError(401, "E-mail ou senha inválidos.");

  const account = role === "motorista" ? motorista! : responsavel!;
  try {
    await issueVerificationCode({ email, role, proposito: "LOGIN", nome: account.nome });
  } catch (err) {
    if (err instanceof ResendCooldownError) return jsonError(429, err.message);
    if (err instanceof EmailSendError) {
      return jsonError(502, "Não foi possível enviar o e-mail de verificação agora. Tente novamente em instantes.");
    }
    throw err;
  }
  return NextResponse.json({ email, role });
}
