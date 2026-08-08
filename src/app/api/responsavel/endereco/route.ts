import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { enderecoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { geocodeEndereco, montarEnderecoTexto } from "@/lib/geocoding";

export async function GET() {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  return NextResponse.json({
    cep: responsavel.cep,
    logradouro: responsavel.logradouro,
    numero: responsavel.numero,
    complemento: responsavel.complemento,
    bairro: responsavel.bairro,
    cidade: responsavel.cidade,
    estado: responsavel.estado,
    enderecoLatitude: responsavel.enderecoLatitude,
    enderecoLongitude: responsavel.enderecoLongitude,
  });
}

/**
 * Cria/atualiza o endereço do responsável e regeocodifica — é esse
 * endereço que a rota otimizada do motorista usa como parada (ver
 * `src/lib/routing/osrm.ts` e `GET /api/motorista/rota`).
 */
export async function PATCH(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = enderecoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { cep, logradouro, numero, complemento, bairro, cidade, estado } = parsed.data;

  const enderecoTexto = montarEnderecoTexto({ logradouro, numero, bairro, cidade, estado });
  const coordenadas = await geocodeEndereco(`${enderecoTexto}, ${cep}, Brasil`);

  const atualizado = await prisma.responsavel.update({
    where: { id: responsavel.id },
    data: {
      cep,
      logradouro,
      numero,
      complemento: complemento || null,
      bairro,
      cidade,
      estado,
      enderecoLatitude: coordenadas?.latitude ?? null,
      enderecoLongitude: coordenadas?.longitude ?? null,
      enderecoAtualizadoEm: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    geocodificado: coordenadas !== null,
    enderecoLatitude: atualizado.enderecoLatitude,
    enderecoLongitude: atualizado.enderecoLongitude,
  });
}
