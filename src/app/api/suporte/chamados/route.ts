import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonValidationError } from "@/lib/http";
import { criarChamadoSuporteSchema } from "@/lib/validation/schemas";

async function usuarioAutenticado() {
  const motorista = await getSession("motorista");
  if (motorista) return { role: "motorista" as const, id: motorista.sub };
  const responsavel = await getSession("responsavel");
  if (responsavel) return { role: "responsavel" as const, id: responsavel.sub };
  return null;
}

export async function GET() {
  const usuario = await usuarioAutenticado();
  if (!usuario) return jsonError(401, "Não autenticado.");

  const where = usuario.role === "motorista" ? { motoristaId: usuario.id } : { responsavelId: usuario.id };
  const [perfil, chamados] = await Promise.all([
    usuario.role === "motorista"
      ? prisma.motorista.findUnique({ where: { id: usuario.id }, select: { nome: true, telefone: true } })
      : prisma.responsavel.findUnique({ where: { id: usuario.id }, select: { nome: true, telefone: true } }),
    prisma.chamadoSuporte.findMany({ where, orderBy: { criadoEm: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({ perfil, chamados });
}

export async function POST(request: NextRequest) {
  const usuario = await usuarioAutenticado();
  if (!usuario) return jsonError(401, "Não autenticado.");
  const body = await request.json().catch(() => null);
  const parsed = criarChamadoSuporteSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const perfil = usuario.role === "motorista"
    ? await prisma.motorista.findUnique({ where: { id: usuario.id }, select: { nome: true, telefone: true } })
    : await prisma.responsavel.findUnique({ where: { id: usuario.id }, select: { nome: true, telefone: true } });
  if (!perfil) return jsonError(401, "Usuário não encontrado.");

  const chamado = await prisma.chamadoSuporte.create({
    data: {
      nome: perfil.nome,
      whatsapp: perfil.telefone,
      descricao: parsed.data.descricao,
      ...(usuario.role === "motorista" ? { motoristaId: usuario.id } : { responsavelId: usuario.id }),
    },
  });
  return NextResponse.json({ chamado }, { status: 201 });
}
