import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { atualizarPerfilSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  return NextResponse.json({
    id: motorista.id,
    nome: motorista.nome,
    email: motorista.email,
    telefone: motorista.telefone,
    cpf: motorista.cpf,
    chavePix: motorista.chavePix,
  });
}

/**
 * Atualiza dados do perfil do motorista — usada tanto pela tela "Editar
 * perfil" (nome/telefone/cpf/senha) quanto pelo PixKeyForm.tsx (só
 * `chavePix`). Todos os campos são opcionais: só atualiza o que veio no
 * corpo da requisição.
 */
export async function PATCH(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = atualizarPerfilSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, telefone, cpf, chavePix, senhaAtual, novaSenha } = parsed.data;

  const data: Prisma.MotoristaUpdateInput = {};
  if (nome !== undefined) data.nome = nome;
  if (telefone !== undefined) data.telefone = telefone;
  if (cpf !== undefined) data.cpf = cpf;
  if (chavePix !== undefined) data.chavePix = chavePix?.trim() || null;

  if (novaSenha) {
    const senhaConfere = await verifyPassword(senhaAtual!, motorista.senhaHash);
    if (!senhaConfere) return jsonError(400, "Senha atual incorreta.");
    data.senhaHash = await hashPassword(novaSenha);
  }

  try {
    const atualizado = await prisma.motorista.update({ where: { id: motorista.id }, data });
    return NextResponse.json({
      ok: true,
      nome: atualizado.nome,
      telefone: atualizado.telefone,
      cpf: atualizado.cpf,
      chavePix: atualizado.chavePix,
    });
  } catch (err) {
    // P2002 = violação de índice único — só pode ser o CPF aqui (email não é
    // editável por essa rota).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(400, "Esse CPF já está cadastrado em outra conta.");
    }
    throw err;
  }
}
