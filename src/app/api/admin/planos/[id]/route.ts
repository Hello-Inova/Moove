import { NextRequest, NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { planoAdminSchema, planoAtivoSchema } from "@/lib/validation/schemas";
import {
  atualizarPlano,
  definirAtivoPlano,
  excluirPlano,
  PlanoCodigoDuplicadoError,
  PlanoEmUsoError,
} from "@/lib/subscription/planos-service";
import { registrarAuditoria } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = planoAdminSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const plano = await atualizarPlano(id, parsed.data);

    await registrarAuditoria({
      acao: "ATUALIZAR_PLANO",
      entidade: "Plano",
      entidadeId: id,
      detalhes: { codigo: plano.codigo, label: plano.label },
      request,
    });

    return NextResponse.json({ plano });
  } catch (err) {
    if (err instanceof PlanoCodigoDuplicadoError) return jsonError(409, err.message);
    throw err;
  }
}

/** Ativar/desativar rapidamente (mostra/some da vitrine do motorista). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = planoAtivoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const plano = await definirAtivoPlano(id, parsed.data.ativo);

  await registrarAuditoria({
    acao: parsed.data.ativo ? "ATIVAR_PLANO" : "DESATIVAR_PLANO",
    entidade: "Plano",
    entidadeId: id,
    detalhes: { codigo: plano.codigo, label: plano.label },
    request,
  });

  return NextResponse.json({ plano });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  try {
    const planoAntesDeExcluir = await prisma.planoAssinatura.findUnique({ where: { id } });
    await excluirPlano(id);

    await registrarAuditoria({
      acao: "EXCLUIR_PLANO",
      entidade: "Plano",
      entidadeId: id,
      detalhes: planoAntesDeExcluir
        ? { codigo: planoAntesDeExcluir.codigo, label: planoAntesDeExcluir.label }
        : undefined,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PlanoEmUsoError) return jsonError(409, err.message);
    throw err;
  }
}
