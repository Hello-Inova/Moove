import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { motoristaRegisterSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { issueVerificationCode, EmailSendError, ResendCooldownError } from "@/lib/email/verification";
import { geocodeEndereco } from "@/lib/geocoding";

/**
 * Não cria a conta ainda — só emite o código de verificação. A conta só
 * passa a existir quando o código é confirmado em
 * POST /api/auth/motorista/register/verificar (ver esse arquivo).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = motoristaRegisterSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, email, telefone, cpf, senha, nomeEscola, cep, logradouro, numero, complemento, bairro, cidade, estado } =
    parsed.data;

  const existente = await prisma.motorista.findUnique({ where: { email } });
  if (existente) {
    return jsonError(409, "Já existe uma conta de motorista com este e-mail.");
  }

  const cpfExistente = await prisma.motorista.findUnique({ where: { cpf } });
  if (cpfExistente) {
    return jsonError(409, "Já existe uma conta de motorista cadastrada com este CPF.");
  }

  const senhaHash = await hashPassword(senha);

  // Mesma lógica do cadastro do responsável: geocodifica o endereço da
  // escola agora (uma vez, no envio do formulário) — se falhar, a conta e a
  // escola ainda são criadas, só sem coordenada; o motorista corrige depois
  // em "Minhas escolas".
  const coordenadas = await geocodeEndereco({ logradouro, numero, bairro, cidade, estado, cep });

  try {
    await issueVerificationCode({
      email,
      role: "motorista",
      proposito: "CADASTRO",
      nome,
      payload: {
        nome,
        telefone,
        cpf,
        senhaHash,
        consentimentoLgpdAceitoEm: new Date().toISOString(),
        nomeEscola,
        cep,
        logradouro,
        numero,
        complemento: complemento || null,
        bairro,
        cidade,
        estado,
        enderecoLatitude: coordenadas?.latitude ?? null,
        enderecoLongitude: coordenadas?.longitude ?? null,
      },
    });
  } catch (err) {
    if (err instanceof ResendCooldownError) return jsonError(429, err.message);
    if (err instanceof EmailSendError) {
      return jsonError(502, "Não foi possível enviar o e-mail de verificação agora. Tente novamente em instantes.");
    }
    throw err;
  }

  return NextResponse.json({ email }, { status: 200 });
}
