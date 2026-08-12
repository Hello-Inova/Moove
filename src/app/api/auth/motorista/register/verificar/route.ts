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

  const resultado = await verifyCode({ email, role: "motorista", proposito: "CADASTRO", codigo });
  if (!resultado.ok) return jsonError(400, resultado.error);

  const payload = resultado.payload as {
    nome: string;
    telefone: string;
    cpf: string;
    senhaHash: string;
    consentimentoLgpdAceitoEm: string;
    nomeEscola: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
    enderecoLatitude: number | null;
    enderecoLongitude: number | null;
    enderecoTextoEncontrado?: string | null;
    enderecoPrecisaoBaixa?: boolean;
  } | null;

  if (!payload) {
    return jsonError(400, "Dados do cadastro não encontrados. Cadastre-se novamente.");
  }

  try {
    const agora = new Date();
    const motorista = await prisma.motorista.create({
      data: {
        nome: payload.nome,
        email,
        telefone: payload.telefone,
        cpf: payload.cpf,
        senhaHash: payload.senhaHash,
        consentimentoLgpdAceitoEm: new Date(payload.consentimentoLgpdAceitoEm),
        emailVerificadoEm: agora,
        testeExpiraEm: calcularTesteExpiraEm(agora),
        escolas: {
          create: {
            nome: payload.nomeEscola,
            cep: payload.cep,
            logradouro: payload.logradouro,
            numero: payload.numero,
            complemento: payload.complemento,
            bairro: payload.bairro,
            cidade: payload.cidade,
            estado: payload.estado,
            enderecoLatitude: payload.enderecoLatitude,
            enderecoLongitude: payload.enderecoLongitude,
            enderecoTextoEncontrado: payload.enderecoTextoEncontrado ?? null,
            enderecoPrecisaoBaixa: payload.enderecoPrecisaoBaixa ?? false,
          },
        },
      },
    });

    await createSession("motorista", motorista.id);

    return NextResponse.json(
      { id: motorista.id, nome: motorista.nome, email: motorista.email },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const alvo = (err.meta?.target as string[] | undefined) ?? [];
      if (alvo.some((c) => c.includes("cpf"))) {
        return jsonError(409, "Já existe uma conta de motorista cadastrada com este CPF.");
      }
      return jsonError(409, "Já existe uma conta de motorista com este e-mail.");
    }
    throw err;
  }
}
