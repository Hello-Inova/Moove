import { NextRequest, NextResponse } from "next/server";
import { executarFechamentoMensal } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";

/**
 * Endpoint HTTP para disparar o fechamento mensal a partir de um agendador
 * externo (ex: Vercel Cron). Protegido por um segredo compartilhado — nunca
 * expor publicamente sem essa checagem, já que dispara geração de cobranças.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return jsonError(401, "Não autorizado.");
  }

  const referenciaMes = request.nextUrl.searchParams.get("referenciaMes") ?? undefined;
  const resumo = await executarFechamentoMensal(referenciaMes);

  return NextResponse.json(resumo);
}
