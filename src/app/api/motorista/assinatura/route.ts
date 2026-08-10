import { NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { diasRestantesConta, getAssinaturaAtual, motoristaTemAcesso } from "@/lib/subscription/service";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const assinatura = await getAssinaturaAtual(motorista.id);

  return NextResponse.json({
    assinatura: assinatura
      ? {
          id: assinatura.id,
          tipoPlano: assinatura.tipoPlano,
          cicloCobranca: assinatura.cicloCobranca,
          qtdAlunosContratados: assinatura.qtdAlunosContratados,
          anosAdicionais: assinatura.anosAdicionais,
          valorTotal: assinatura.valorTotal.toString(),
          status: assinatura.status,
          expiraEm: assinatura.expiraEm,
        }
      : null,
    testeExpiraEm: motorista.testeExpiraEm,
    diasRestantesTeste: diasRestantesConta(motorista.testeExpiraEm),
    temAcesso: motoristaTemAcesso(motorista, assinatura),
  });
}
