import { NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { sincronizarCobrancasAlunoPendentes } from "@/lib/subscription/cobranca-aluno-pagamento";

/**
 * Rede de segurança contra falha do webhook da Asaas (mesmo padrão de
 * /api/motorista/assinatura/sincronizar) — chamada pela tela
 * /motorista/vinculos sempre que ela abre, pra revalidar direto na Asaas
 * qualquer cobrança por aluno que ainda esteja PENDENTE aqui mas já tenha
 * sido paga do lado de lá.
 */
export async function POST() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const atualizadas = await sincronizarCobrancasAlunoPendentes(motorista.id);

  return NextResponse.json({ atualizadas });
}
