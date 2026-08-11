import { NextRequest, NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { planoAdminSchema } from "@/lib/validation/schemas";
import { criarPlano, listarTodosPlanos, PlanoCodigoDuplicadoError } from "@/lib/subscription/planos-service";
import type { PublicoPlano } from "@/lib/subscription/plans";
import { registrarAuditoria } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const publicoParam = request.nextUrl.searchParams.get("publico");
  const publico = publicoParam === "MOTORISTA" || publicoParam === "RESPONSAVEL" ? (publicoParam as PublicoPlano) : undefined;

  const planos = await listarTodosPlanos(publico);
  return NextResponse.json({ planos });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = planoAdminSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const plano = await criarPlano(parsed.data);

    await registrarAuditoria({
      acao: "CRIAR_PLANO",
      entidade: "Plano",
      entidadeId: plano.id,
      detalhes: { codigo: plano.codigo, label: plano.label, publico: plano.publico },
      request,
    });

    return NextResponse.json({ plano }, { status: 201 });
  } catch (err) {
    if (err instanceof PlanoCodigoDuplicadoError) return jsonError(409, err.message);
    throw err;
  }
}
