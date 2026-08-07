import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  // Isolamento: a query já filtra por responsavelId === sessão autenticada,
  // então um vínculo nunca expõe dados de outro responsável.
  const vinculos = await prisma.vinculo.findMany({
    where: { responsavelId: responsavel.id },
    orderBy: { criadoEm: "desc" },
    include: {
      motorista: {
        select: { nome: true, telefone: true, veiculos: { select: { placa: true, modelo: true } } },
      },
    },
  });

  return NextResponse.json(
    vinculos.map((v) => ({
      id: v.id,
      status: v.status,
      motoristaNome: v.motorista.nome,
      motoristaTelefone: v.motorista.telefone,
      veiculos: v.motorista.veiculos,
      criadoEm: v.criadoEm,
      revogadoEm: v.revogadoEm,
    }))
  );
}
