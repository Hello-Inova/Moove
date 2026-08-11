import { NextRequest, NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { atualizarStatusContaSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit-log";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = atualizarStatusContaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const responsavel = await prisma.responsavel.findUnique({ where: { id } });
  if (!responsavel) return jsonError(404, "Responsável não encontrado.");

  await prisma.responsavel.update({ where: { id }, data: { statusConta: parsed.data.statusConta } });

  await registrarAuditoria({
    acao: parsed.data.statusConta === "SUSPENSA" ? "SUSPENDER_CONTA" : "REATIVAR_CONTA",
    entidade: "Responsavel",
    entidadeId: id,
    detalhes: { nome: responsavel.nome, email: responsavel.email, statusConta: parsed.data.statusConta },
    request,
  });

  return NextResponse.json({ ok: true });
}
