import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { responsavelRegisterSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { issueVerificationCode, EmailSendError, ResendCooldownError } from "@/lib/email/verification";
import { geocodeEndereco } from "@/lib/geocoding";

/**
 * Não cria a conta ainda — só emite o código de verificação. A conta só
 * passa a existir quando o código é confirmado em
 * POST /api/auth/responsavel/register/verificar (ver esse arquivo).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = responsavelRegisterSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, email, telefone, senha, cep, logradouro, numero, complemento, bairro, cidade, estado } = parsed.data;

  const existente = await prisma.responsavel.findUnique({ where: { email } });
  if (existente) {
    return jsonError(409, "Já existe uma conta de responsável com este e-mail.");
  }

  const senhaHash = await hashPassword(senha);

  // Geocodifica o endereço agora (não é digitação em tempo real, é uma
  // chamada só no envio do cadastro) — se falhar, a conta ainda é criada
  // normalmente; o responsável pode corrigir/tentar de novo depois em
  // "Meu endereço", e até lá esse vínculo simplesmente não entra na rota
  // otimizada do motorista. Passa o número separado (não embutido numa
  // frase única) para o Nominatim localizar a casa certa, não só a rua.
  const coordenadas = await geocodeEndereco({ logradouro, numero, bairro, cidade, estado, cep });

  try {
    await issueVerificationCode({
      email,
      role: "responsavel",
      proposito: "CADASTRO",
      nome,
      payload: {
        nome,
        telefone,
        senhaHash,
        consentimentoLgpdAceitoEm: new Date().toISOString(),
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
