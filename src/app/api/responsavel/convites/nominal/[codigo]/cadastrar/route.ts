import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { responsavelRegisterSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { issueVerificationCode, EmailSendError, ResendCooldownError } from "@/lib/email/verification";

/**
 * Passo 1 do convite nominal (depois da tela pré-preenchida): igual ao
 * cadastro normal do responsável (não cria a conta ainda, só emite o
 * código de verificação — ver .../verificar), mas guarda o código do
 * convite no payload pra a etapa seguinte já criar o Aluno junto.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  const convite = await prisma.convite.findUnique({ where: { codigo: codigo.toUpperCase() } });
  if (!convite || convite.tipo !== "NOMINAL" || convite.status !== "PENDENTE") {
    return jsonError(404, "Convite não encontrado ou não está mais disponível.");
  }
  if (convite.expiraEm.getTime() < Date.now()) {
    return jsonError(410, "Este convite expirou. Peça pro motorista gerar um novo.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = responsavelRegisterSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, email, telefone, cpf, senha } = parsed.data;

  const existente = await prisma.responsavel.findUnique({ where: { email } });
  if (existente) {
    return jsonError(409, "Já existe uma conta de responsável com este e-mail. Faça login e peça um código de convite normal ao motorista.");
  }

  const cpfExistente = await prisma.responsavel.findUnique({ where: { cpf } });
  if (cpfExistente) {
    return jsonError(409, "Já existe uma conta de responsável cadastrada com este CPF.");
  }

  const senhaHash = await hashPassword(senha);

  try {
    await issueVerificationCode({
      email,
      role: "responsavel",
      proposito: "CADASTRO",
      nome,
      payload: {
        nome,
        telefone,
        cpf,
        senhaHash,
        consentimentoLgpdAceitoEm: new Date().toISOString(),
        conviteNominalCodigo: convite.codigo,
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
