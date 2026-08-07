import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { calcularExpiracaoConvite, expirarConvitesVencidos, gerarCodigoConvite } from "@/lib/convite";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  await expirarConvitesVencidos(motorista.id);

  const convites = await prisma.convite.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
    include: { usadoPorResponsavel: { select: { nome: true } } },
  });

  return NextResponse.json(
    convites.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      status: c.status,
      criadoEm: c.criadoEm,
      expiraEm: c.expiraEm,
      usadoEm: c.usadoEm,
      usadoPor: c.usadoPorResponsavel?.nome ?? null,
    }))
  );
}

export async function POST() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  // Gera um código único; em caso de colisão (extremamente improvável dado o
  // espaço de 8 caracteres em alfabeto de 32 símbolos), tenta novamente.
  let convite = null;
  for (let attempt = 0; attempt < 5 && !convite; attempt++) {
    try {
      convite = await prisma.convite.create({
        data: {
          codigo: gerarCodigoConvite(),
          motoristaId: motorista.id,
          expiraEm: calcularExpiracaoConvite(),
        },
      });
    } catch {
      // colisão de código único — tenta novamente no próximo loop
    }
  }

  if (!convite) return jsonError(500, "Não foi possível gerar o convite. Tente novamente.");

  return NextResponse.json(
    {
      id: convite.id,
      codigo: convite.codigo,
      status: convite.status,
      criadoEm: convite.criadoEm,
      expiraEm: convite.expiraEm,
    },
    { status: 201 }
  );
}
