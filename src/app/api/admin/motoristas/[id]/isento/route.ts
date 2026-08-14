import { NextRequest, NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { atualizarIsencaoSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit-log";

/**
 * Liga/desliga a isenção de cobrança de um motorista (ver comentário em
 * Motorista.isentoCobranca no schema) — usado pelo botão na listagem do
 * admin (/admin/motoristas) pra dar cortesia sem precisar ficar forçando
 * ativação de assinatura toda vez que ela vence.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = atualizarIsencaoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const motorista = await prisma.motorista.findUnique({ where: { id } });
  if (!motorista) return jsonError(404, "Motorista não encontrado.");

  await prisma.motorista.update({ where: { id }, data: { isentoCobranca: parsed.data.isento } });

  await registrarAuditoria({
    acao: "ATUALIZAR_ISENCAO",
    entidade: "Motorista",
    entidadeId: id,
    detalhes: { nome: motorista.nome, email: motorista.email, isento: parsed.data.isento },
    request,
  });

  return NextResponse.json({ ok: true });
}
