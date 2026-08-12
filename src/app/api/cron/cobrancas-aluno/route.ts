import { NextRequest, NextResponse } from "next/server";

import { processarCobrancasAlunoVencidas } from "@/lib/subscription/cobranca-aluno";

function autenticado(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Cobrança por aluno vinculado, rodando diariamente (ver vercel.json).
 * Avalia todo vínculo ATIVO cujo corte de 30 dias já venceu e gera as
 * CobrancaAluno cabíveis — ver src/lib/subscription/cobranca-aluno.ts pra
 * regra completa. Também pode ser chamado manualmente com `curl -H
 * "Authorization: Bearer $CRON_SECRET" https://.../api/cron/cobrancas-aluno`.
 */
export async function GET(request: NextRequest) {
  if (!autenticado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resultado = await processarCobrancasAlunoVencidas();

  return NextResponse.json({ ok: true, ...resultado });
}
