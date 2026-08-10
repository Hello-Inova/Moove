import { NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { listarPlanosAtivos } from "@/lib/subscription/planos-service";

/**
 * Planos visíveis para o motorista escolher/assinar. Sempre lidos do banco
 * (tabela `planos_assinatura`) — qualquer criação/edição/exclusão feita pelo
 * admin aparece aqui na próxima carga da página, sem precisar de deploy.
 */
export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const planos = await listarPlanosAtivos("MOTORISTA");
  return NextResponse.json({ planos });
}
