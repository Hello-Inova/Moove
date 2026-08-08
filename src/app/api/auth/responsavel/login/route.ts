import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { issueVerificationCode, ResendCooldownError } from "@/lib/email/verification";

/**
 * Primeira etapa do login: valida e-mail+senha e, se ok, envia um código de
 * verificação por e-mail — a sessão só é criada em
 * POST /api/auth/responsavel/login/verificar depois do código confirmado.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, senha } = parsed.data;

  const responsavel = await prisma.responsavel.findUnique({ where: { email } });
  const senhaOk = responsavel ? await verifyPassword(senha, responsavel.senhaHash) : false;

  if (!responsavel || !senhaOk) {
    return jsonError(401, "E-mail ou senha inválidos.");
  }

  try {
    await issueVerificationCode({ email, role: "responsavel", proposito: "LOGIN", nome: responsavel.nome });
  } catch (err) {
    if (err instanceof ResendCooldownError) return jsonError(429, err.message);
    throw err;
  }

  return NextResponse.json({ email });
}
