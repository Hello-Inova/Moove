import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { atualizarPerfilSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  return NextResponse.json({
    id: responsavel.id,
    nome: responsavel.nome,
    email: responsavel.email,
    telefone: responsavel.telefone,
    cpf: responsavel.cpf,
  });
}

/**
 * Atualiza dados do perfil do responsável — usada pela tela "Editar
 * perfil" (nome/telefone/cpf/senha). Mesmo formato da rota equivalente do
 * motorista (ver /api/motorista/me) — todos os campos opcionais, só
 * atualiza o que veio no corpo.
 */
export async function PATCH(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = atualizarPerfilSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, telefone, cpf, senhaAtual, novaSenha } = parsed.data;

  const data: Prisma.ResponsavelUpdateInput = {};
  if (nome !== undefined) data.nome = nome;
  if (telefone !== undefined) data.telefone = telefone;
  if (cpf !== undefined) data.cpf = cpf;

  if (novaSenha) {
    const senhaConfere = await verifyPassword(senhaAtual!, responsavel.senhaHash);
    if (!senhaConfere) return jsonError(400, "Senha atual incorreta.");
    data.senhaHash = await hashPassword(novaSenha);
  }

  try {
    const atualizado = await prisma.responsavel.update({ where: { id: responsavel.id }, data });
    return NextResponse.json({
      ok: true,
      nome: atualizado.nome,
      telefone: atualizado.telefone,
      cpf: atualizado.cpf,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(400, "Esse CPF já está cadastrado em outra conta.");
    }
    throw err;
  }
}
