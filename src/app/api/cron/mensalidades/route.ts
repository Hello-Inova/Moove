import { NextRequest, NextResponse } from "next/server";

import { processarMensalidadesTransporteVencidas } from "@/lib/mensalidade/mensalidade-transporte";

function autenticado(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Mensalidade do transporte (dinheiro peer-to-peer entre motorista e
 * responsável, fora da plataforma), rodando diariamente (ver vercel.json).
 * Avalia todo vínculo ATIVO com mensalidade configurada e gera a
 * MensalidadeTransporte do mês corrente quando o dia de pagamento chega —
 * ver src/lib/mensalidade/mensalidade-transporte.ts pra regra completa.
 */
export async function GET(request: NextRequest) {
  if (!autenticado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resultado = await processarMensalidadesTransporteVencidas();

  return NextResponse.json({ ok: true, ...resultado });
}
