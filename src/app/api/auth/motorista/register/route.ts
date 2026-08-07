import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { motoristaRegisterSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { getPlanoDefaults } from "@/lib/billing/config";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = motoristaRegisterSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, email, telefone, senha } = parsed.data;
  const senhaHash = await hashPassword(senha);

  try {
    const motorista = await prisma.motorista.create({
      data: {
        nome,
        email,
        telefone,
        senhaHash,
        consentimentoLgpdAceitoEm: new Date(),
        plano: { create: getPlanoDefaults() },
      },
    });

    await createSession("motorista", motorista.id);

    return NextResponse.json(
      { id: motorista.id, nome: motorista.nome, email: motorista.email },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, "Já existe uma conta de motorista com este e-mail.");
    }
    throw err;
  }
}
