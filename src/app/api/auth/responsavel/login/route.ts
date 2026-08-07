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

  const responsavel = await prisma.responsavel.findUnique({ where: { email } });
  const senhaOk = responsavel ? await verifyPassword(senha, responsavel.senhaHash) : false;

  if (!responsavel || !senhaOk) {
    return jsonError(401, "E-mail ou senha inválidos.");
  }

  await createSession("responsavel", responsavel.id);

  return NextResponse.json({ id: responsavel.id, nome: responsavel.nome, email: responsavel.email });
}
