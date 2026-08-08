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

  const resultado = await verifyCode({ email, role: "motorista", proposito: "LOGIN", codigo });
  if (!resultado.ok) return jsonError(400, resultado.error);

  const motorista = await prisma.motorista.findUnique({ where: { email } });
  if (!motorista || motorista.statusConta !== "ATIVA") {
    return jsonError(403, "Conta indisponível. Entre em contato com o suporte.");
  }

  await prisma.motorista.update({
    where: { id: motorista.id },
    data: { emailVerificadoEm: motorista.emailVerificadoEm ?? new Date() },
  });

  await createSession("motorista", motorista.id);

  return NextResponse.json({ id: motorista.id, nome: motorista.nome, email: motorista.email });
}
