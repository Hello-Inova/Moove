import { NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { abrirOuReutilizarPercurso } from "@/lib/percurso";

/**
 * Abre (ou reaproveita) o percurso do dia — chamado quando o motorista
 * clica em "Iniciar rota" (ver useLocationSharing.ts). É esse registro que
 * acumula os pontos de GPS (ver POST /api/motorista/localizacao) até o
 * motorista clicar em "Encerrar rota".
 */
export async function POST() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const percursoId = await abrirOuReutilizarPercurso(motorista.id);
  return NextResponse.json({ percursoId });
}
