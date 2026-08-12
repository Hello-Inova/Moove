import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { enderecoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { geocodeCidadeAproximado, geocodeEndereco } from "@/lib/geocoding";

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
    enderecoTextoEncontrado: responsavel.enderecoTextoEncontrado,
    enderecoConfirmado: responsavel.enderecoConfirmado,
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

  const coordenadas = await geocodeEndereco({ logradouro, numero, bairro, cidade, estado, cep });

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
      enderecoTextoEncontrado: coordenadas?.enderecoEncontrado ?? null,
      // Todo endereço recém-(re)geocodificado começa como NÃO confirmado —
      // mesmo que a coordenada esteja certa, ninguém olhou o pino ainda.
      enderecoConfirmado: false,
      enderecoAtualizadoEm: new Date(),
    },
  });

  // Se a geocodificação falhou de vez, busca um centro aproximado (só
  // cidade/UF) pra pelo menos centralizar o mapa de ajuste manual — sem
  // isso a pessoa fica sem mapa nenhum pra posicionar o pino.
  const centroAproximado = coordenadas === null ? await geocodeCidadeAproximado(cidade, estado) : null;

  return NextResponse.json({
    ok: true,
    geocodificado: coordenadas !== null,
    enderecoLatitude: atualizado.enderecoLatitude,
    enderecoLongitude: atualizado.enderecoLongitude,
    enderecoTextoEncontrado: atualizado.enderecoTextoEncontrado,
    centroAproximado,
  });
}
