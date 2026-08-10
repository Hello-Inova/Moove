import { NextResponse } from "next/server";

import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { listarPlanosAtivos } from "@/lib/subscription/planos-service";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const planos = await listarPlanosAtivos("RESPONSAVEL");
  return NextResponse.json({ planos });
}
