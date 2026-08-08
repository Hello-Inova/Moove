import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";

/**
 * O fechamento mensal por aluno excedente (`src/lib/billing/service.ts`) foi
 * substituído pelas assinaturas pré-pagas (Basic/Pró/Max — ver
 * `src/lib/subscription`). Esse endpoint (e o cron que o chamava, removido
 * de `vercel.json`) fica desativado para não gerar cobranças do modelo
 * antigo em paralelo às assinaturas.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return jsonError(401, "Não autorizado.");
  }

  return NextResponse.json({
    desativado: true,
    motivo: "Fechamento mensal substituído pelas assinaturas pré-pagas (Basic/Pró/Max).",
  });
}
