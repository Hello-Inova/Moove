import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, senha } = parsed.data;

  const motorista = await prisma.motorista.findUnique({ where: { email } });
  const senhaOk = motorista ? await verifyPassword(senha, motorista.senhaHash) : false;

  // Mensagem genérica: não revelar se o e-mail existe ou não.
  if (!motorista || !senhaOk) {
    return jsonError(401, "E-mail ou senha inválidos.");
  }

  if (motorista.statusConta !== "ATIVA") {
    return jsonError(403, "Conta inativa. Entre em contato com o suporte.");
  }

  await createSession("motorista", motorista.id);

  return NextResponse.json({ id: motorista.id, nome: motorista.nome, email: motorista.email });
}
