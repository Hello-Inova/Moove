import { NextResponse } from "next/server";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  return NextResponse.json({
    id: responsavel.id,
    nome: responsavel.nome,
    email: responsavel.email,
    telefone: responsavel.telefone,
  });
}
