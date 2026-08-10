import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { fecharPercurso } from "@/lib/percurso";

/**
 * Botão "Encerrar rota" (RotaPanel.tsx) — fecha o percurso em andamento,
 * calculando a distância percorrida e um snapshot de quantos alunos
 * embarcaram/ficaram ausentes naquele dia. Não para o compartilhamento de
 * GPS sozinho — isso é feito junto pelo cliente via `confirmAndRun`
 * (mesmo fluxo de confirmação do botão "Parar").
 */
export async function POST() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const aberto = await prisma.percursoDia.findFirst({
    where: { motoristaId: motorista.id, encerradoEm: null },
    orderBy: { iniciadoEm: "desc" },
  });

  if (!aberto) {
    return jsonError(409, "Nenhuma rota em andamento para encerrar.");
  }

  const fechado = await fecharPercurso(aberto.id);
  return NextResponse.json({
    id: fechado!.id,
    totalAlunos: fechado!.totalAlunos,
    totalEmbarcaram: fechado!.totalEmbarcaram,
    totalAusentes: fechado!.totalAusentes,
    distanciaMetros: fechado!.distanciaMetros,
  });
}
