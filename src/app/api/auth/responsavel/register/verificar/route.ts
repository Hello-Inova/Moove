import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

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

  const resultado = await verifyCode({ email, role: "responsavel", proposito: "CADASTRO", codigo });
  if (!resultado.ok) return jsonError(400, resultado.error);

  const payload = resultado.payload as {
    nome: string;
    telefone: string;
    senhaHash: string;
    consentimentoLgpdAceitoEm: string;
  } | null;

  if (!payload) {
    return jsonError(400, "Dados do cadastro não encontrados. Cadastre-se novamente.");
  }

  try {
    const responsavel = await prisma.responsavel.create({
      data: {
        nome: payload.nome,
        email,
        telefone: payload.telefone,
        senhaHash: payload.senhaHash,
        consentimentoLgpdAceitoEm: new Date(payload.consentimentoLgpdAceitoEm),
        emailVerificadoEm: new Date(),
      },
    });

    await createSession("responsavel", responsavel.id);

    return NextResponse.json(
      { id: responsavel.id, nome: responsavel.nome, email: responsavel.email },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, "Já existe uma conta de responsável com este e-mail.");
    }
    throw err;
  }
}
