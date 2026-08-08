import { NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { assinaturaPermiteAcesso, diasRestantesTeste, getAssinaturaAtual } from "@/lib/subscription/service";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const assinatura = await getAssinaturaAtual(motorista.id);

  if (!assinatura) {
    return NextResponse.json({ assinatura: null, diasRestantesTeste: null, temAcesso: false });
  }

  return NextResponse.json({
    assinatura: {
      id: assinatura.id,
      tipoPlano: assinatura.tipoPlano,
      cicloCobranca: assinatura.cicloCobranca,
      qtdAlunosContratados: assinatura.qtdAlunosContratados,
      anosAdicionais: assinatura.anosAdicionais,
      valorTotal: assinatura.valorTotal.toString(),
      status: assinatura.status,
      testeExpiraEm: assinatura.testeExpiraEm,
      expiraEm: assinatura.expiraEm,
    },
    diasRestantesTeste: diasRestantesTeste(assinatura),
    temAcesso: assinaturaPermiteAcesso(assinatura),
  });
}
