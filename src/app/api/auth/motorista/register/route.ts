import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { motoristaRegisterSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { issueVerificationCode, EmailSendError, ResendCooldownError } from "@/lib/email/verification";

/**
 * Não cria a conta ainda — só emite o código de verificação. A conta só
 * passa a existir quando o código é confirmado em
 * POST /api/auth/motorista/register/verificar (ver esse arquivo).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = motoristaRegisterSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, email, telefone, senha } = parsed.data;

  const existente = await prisma.motorista.findUnique({ where: { email } });
  if (existente) {
    return jsonError(409, "Já existe uma conta de motorista com este e-mail.");
  }

  const senhaHash = await hashPassword(senha);

  try {
    await issueVerificationCode({
      email,
      role: "motorista",
      proposito: "CADASTRO",
      nome,
      payload: {
        nome,
        telefone,
        senhaHash,
        consentimentoLgpdAceitoEm: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof ResendCooldownError) return jsonError(429, err.message);
    if (err instanceof EmailSendError) {
      return jsonError(502, "Não foi possível enviar o e-mail de verificação agora. Tente novamente em instantes.");
    }
    throw err;
  }

  return NextResponse.json({ email }, { status: 200 });
}
