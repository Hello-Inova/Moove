import { NextResponse } from "next/server";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  return NextResponse.json({
    id: motorista.id,
    nome: motorista.nome,
    email: motorista.email,
    telefone: motorista.telefone,
  });
}
