import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { verificarCodigoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { verifyCode } from "@/lib/email/verification";
import { calcularTesteExpiraEm } from "@/lib/subscription/plans";

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
    cpf: string;
    senhaHash: string;
    consentimentoLgpdAceitoEm: string;
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string | null;
    bairro?: string;
    cidade?: string;
    estado?: string;
    enderecoLatitude?: number | null;
    enderecoLongitude?: number | null;
  } | null;

  if (!payload) {
    return jsonError(400, "Dados do cadastro não encontrados. Cadastre-se novamente.");
  }

  try {
    const agora = new Date();
    const responsavel = await prisma.responsavel.create({
      data: {
        nome: payload.nome,
        email,
        telefone: payload.telefone,
        cpf: payload.cpf,
        senhaHash: payload.senhaHash,
        consentimentoLgpdAceitoEm: new Date(payload.consentimentoLgpdAceitoEm),
        emailVerificadoEm: agora,
        testeExpiraEm: calcularTesteExpiraEm(agora),
        cep: payload.cep,
        logradouro: payload.logradouro,
        numero: payload.numero,
        complemento: payload.complemento ?? null,
        bairro: payload.bairro,
        cidade: payload.cidade,
        estado: payload.estado,
        enderecoLatitude: payload.enderecoLatitude ?? null,
        enderecoLongitude: payload.enderecoLongitude ?? null,
        enderecoAtualizadoEm: payload.cep ? new Date() : null,
      },
    });

    await createSession("responsavel", responsavel.id);

    return NextResponse.json(
      { id: responsavel.id, nome: responsavel.nome, email: responsavel.email },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const alvo = (err.meta?.target as string[] | undefined) ?? [];
      if (alvo.some((c) => c.includes("cpf"))) {
        return jsonError(409, "Já existe uma conta de responsável cadastrada com este CPF.");
      }
      return jsonError(409, "Já existe uma conta de responsável com este e-mail.");
    }
    throw err;
  }
}
