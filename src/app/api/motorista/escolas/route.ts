import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { escolaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { geocodeEndereco } from "@/lib/geocoding";

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const escolas = await prisma.escola.findMany({
    where: { motoristaId: motorista.id },
    orderBy: { criadoEm: "desc" },
  });

  return NextResponse.json(
    escolas.map((e) => ({
      id: e.id,
      nome: e.nome,
      cep: e.cep,
      logradouro: e.logradouro,
      numero: e.numero,
      complemento: e.complemento,
      bairro: e.bairro,
      cidade: e.cidade,
      estado: e.estado,
      geocodificada: e.enderecoLatitude !== null && e.enderecoLongitude !== null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = escolaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { nome, cep, logradouro, numero, complemento, bairro, cidade, estado } = parsed.data;

  const coordenadas = await geocodeEndereco({ logradouro, numero, bairro, cidade, estado, cep });

  const escola = await prisma.escola.create({
    data: {
      motoristaId: motorista.id,
      nome,
      cep,
      logradouro,
      numero,
      complemento: complemento || null,
      bairro,
      cidade,
      estado,
      enderecoLatitude: coordenadas?.latitude ?? null,
      enderecoLongitude: coordenadas?.longitude ?? null,
    },
  });

  return NextResponse.json(
    {
      id: escola.id,
      nome: escola.nome,
      geocodificada: coordenadas !== null,
    },
    { status: 201 }
  );
}
