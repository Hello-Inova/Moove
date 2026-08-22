import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { verificarCodigoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { verifyCode } from "@/lib/email/verification";
import { calcularTesteExpiraEm } from "@/lib/subscription/plans";
import type { DadosAlunoConviteNominal } from "@/lib/convite";

/**
 * Passo 2 do convite nominal: confirma o código, cria a conta do
 * responsável E o Aluno (a partir de `Convite.dadosAluno`) na mesma
 * transação, já loga o responsável (mesmo padrão do cadastro normal) e
 * marca `alunoIdNominal` no convite pra a etapa de assinatura conseguir
 * achar o aluno certo depois. O contrato/vínculo ainda NÃO é criado aqui —
 * só na assinatura (ver .../assinar).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = verificarCodigoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, codigo: codigoVerificacao } = parsed.data;

  const resultado = await verifyCode({ email, role: "responsavel", proposito: "CADASTRO", codigo: codigoVerificacao });
  if (!resultado.ok) return jsonError(400, resultado.error);

  const payload = resultado.payload as {
    nome: string;
    telefone: string;
    cpf: string;
    senhaHash: string;
    consentimentoLgpdAceitoEm: string;
    conviteNominalCodigo?: string;
  } | null;

  if (!payload || payload.conviteNominalCodigo !== codigo.toUpperCase()) {
    return jsonError(400, "Dados do cadastro não encontrados. Reabra o link do convite e tente de novo.");
  }

  const convite = await prisma.convite.findUnique({ where: { codigo: codigo.toUpperCase() } });
  if (!convite || convite.tipo !== "NOMINAL" || convite.status !== "PENDENTE") {
    return jsonError(409, "Este convite não está mais disponível.");
  }

  const dadosAluno = convite.dadosAluno as unknown as DadosAlunoConviteNominal | null;
  if (!dadosAluno) return jsonError(500, "Convite com dados incompletos.");

  try {
    const agora = new Date();

    const { responsavel, aluno } = await prisma.$transaction(async (tx) => {
      const responsavel = await tx.responsavel.create({
        data: {
          nome: payload.nome,
          email,
          telefone: payload.telefone,
          cpf: payload.cpf,
          senhaHash: payload.senhaHash,
          consentimentoLgpdAceitoEm: new Date(payload.consentimentoLgpdAceitoEm),
          emailVerificadoEm: agora,
          testeExpiraEm: calcularTesteExpiraEm(agora),
        },
      });

      const aluno = await tx.aluno.create({
        data: {
          responsavelId: responsavel.id,
          nome: dadosAluno.nomeAluno,
        },
      });

      await tx.convite.update({ where: { id: convite.id }, data: { alunoIdNominal: aluno.id } });

      return { responsavel, aluno };
    });

    await createSession("responsavel", responsavel.id);

    return NextResponse.json(
      { responsavelId: responsavel.id, alunoId: aluno.id, nome: responsavel.nome, email: responsavel.email },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError(409, "Já existe uma conta com esse e-mail ou CPF. Faça login em vez de se cadastrar de novo.");
    }
    throw err;
  }
}
