import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit-log";

const schema = z.object({ dias: z.number().int().min(0).max(365) });

export async function GET() {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");
  const configuracao = await prisma.configuracaoSistema.findUnique({ where: { id: "global" } });
  return NextResponse.json({ dias: configuracao?.periodoTesteDias ?? 7 });
}

export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const configuracao = await prisma.configuracaoSistema.upsert({
    where: { id: "global" },
    create: { id: "global", periodoTesteDias: parsed.data.dias },
    update: { periodoTesteDias: parsed.data.dias },
  });
  await registrarAuditoria({
    acao: "ATUALIZAR_PERIODO_TESTE",
    entidade: "configuracoes_sistema",
    entidadeId: configuracao.id,
    detalhes: { periodoTesteDias: configuracao.periodoTesteDias },
    request,
  });
  return NextResponse.json({ dias: configuracao.periodoTesteDias });
}
