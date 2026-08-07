import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { atualizarLocalizacaoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { isLocationStale } from "@/lib/location";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const localizacao = await prisma.localizacao.findUnique({ where: { motoristaId: motorista.id } });
  if (!localizacao) return NextResponse.json({ localizacao: null });

  return NextResponse.json({
    localizacao: {
      latitude: localizacao.latitude,
      longitude: localizacao.longitude,
      atualizadoEm: localizacao.atualizadoEm,
      desatualizada: isLocationStale(localizacao.atualizadoEm),
    },
  });
}

export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = atualizarLocalizacaoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { latitude, longitude } = parsed.data;

  await prisma.localizacao.upsert({
    where: { motoristaId: motorista.id },
    create: { motoristaId: motorista.id, latitude, longitude },
    update: { latitude, longitude },
  });

  return NextResponse.json({ ok: true });
}
