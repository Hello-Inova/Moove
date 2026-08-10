import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { getAssinaturaResponsavelAtual, vagasDisponiveisParaVincular } from "@/lib/subscription/service";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const assinatura = await getAssinaturaResponsavelAtual(responsavel.id);
  const vagasDisponiveis = await vagasDisponiveisParaVincular(responsavel.id);
  const totalAlunos = await prisma.aluno.count({ where: { responsavelId: responsavel.id } });

  return NextResponse.json({
    assinatura: assinatura
      ? {
          id: assinatura.id,
          tipoPlano: assinatura.tipoPlano,
          planoLabel: assinatura.planoLabel,
          status: assinatura.status,
          qtdAlunosContratados: assinatura.qtdAlunosContratados,
          valorTotal: Number(assinatura.valorTotal),
          expiraEm: assinatura.expiraEm,
        }
      : null,
    vagasDisponiveis,
    totalAlunos,
  });
}
