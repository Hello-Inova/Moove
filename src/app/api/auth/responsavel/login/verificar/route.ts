import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { verificarCodigoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { verifyCode } from "@/lib/email/verification";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = verificarCodigoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, codigo } = parsed.data;

  const resultado = await verifyCode({ email, role: "responsavel", proposito: "LOGIN", codigo });
  if (!resultado.ok) return jsonError(400, resultado.error);

  const responsavel = await prisma.responsavel.findUnique({ where: { email } });
  if (!responsavel) {
    return jsonError(403, "Conta indisponível. Entre em contato com o suporte.");
  }

  await prisma.responsavel.update({
    where: { id: responsavel.id },
    data: { emailVerificadoEm: responsavel.emailVerificadoEm ?? new Date() },
  });

  await createSession("responsavel", responsavel.id);

  return NextResponse.json({ id: responsavel.id, nome: responsavel.nome, email: responsavel.email });
}
