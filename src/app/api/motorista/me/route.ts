import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { atualizarChavePixSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  return NextResponse.json({
    id: motorista.id,
    nome: motorista.nome,
    email: motorista.email,
    telefone: motorista.telefone,
    chavePix: motorista.chavePix,
  });
}

/**
 * Atualiza a chave PIX do motorista, usada só pra montar a mensagem de
 * WhatsApp de cobrança por aluno (ver módulo de gestão de alunos) — a
 * plataforma não processa esse valor.
 */
export async function PATCH(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = atualizarChavePixSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const chavePix = parsed.data.chavePix?.trim() || null;

  await prisma.motorista.update({
    where: { id: motorista.id },
    data: { chavePix },
  });

  return NextResponse.json({ ok: true, chavePix });
}
