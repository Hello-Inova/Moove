import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const cobrancas = await prisma.cobranca.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { referenciaMes: "desc" },
  });

  return NextResponse.json(
    cobrancas.map((c) => ({
      id: c.id,
      referenciaMes: c.referenciaMes,
      qtdAlunosVinculados: c.qtdAlunosVinculados,
      qtdAlunosCobrados: c.qtdAlunosCobrados,
      valorTotal: c.valorTotal.toString(),
      status: c.status,
      geradoEm: c.geradoEm,
      pagoEm: c.pagoEm,
    }))
  );
}
