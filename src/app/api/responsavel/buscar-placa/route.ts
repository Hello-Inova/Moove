import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { buscarPlacaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { isLocationStale } from "@/lib/location";
import { calcularRotaSimples } from "@/lib/routing/osrm";

export type RotaAteResponsavel = {
  destino: { latitude: number; longitude: number };
  distanciaMetros: number;
  duracaoSegundos: number;
  geometria: [number, number][];
};

export type BuscaPlacaResponse = {
  veiculo: { placa: string; modelo: string };
  motorista: { nome: string };
  localizacao: { latitude: number; longitude: number; atualizadoEm: string; desatualizada: boolean } | null;
  rota: RotaAteResponsavel | null;
};

/**
 * Ponto de segurança mais crítico do sistema (regra de negócio 4): nenhuma
 * localização é retornada sem (a) responsável autenticado E (b) um vínculo
 * ATIVO entre esse responsável e o motorista dono da placa buscada. As duas
 * checagens acontecem em toda chamada — não há cache de autorização — para
 * que uma revogação tenha efeito imediato no próximo polling do mapa.
 */
export async function GET(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const placaRaw = request.nextUrl.searchParams.get("placa") ?? "";
  const parsed = buscarPlacaSchema.safeParse({ placa: placaRaw });
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { placa } = parsed.data;

  const veiculo = await prisma.veiculo.findUnique({
    where: { placa },
    include: { motorista: { select: { id: true, nome: true } } },
  });
  if (!veiculo) return jsonError(404, "Veículo não encontrado.");

  const vinculo = await prisma.vinculo.findFirst({
    where: { motoristaId: veiculo.motoristaId, responsavelId: responsavel.id, status: "ATIVO" },
  });
  if (!vinculo) {
    return jsonError(
      403,
      "Você não tem vínculo ativo com o motorista deste veículo. Peça um código de convite a ele."
    );
  }

  const localizacao = await prisma.localizacao.findUnique({ where: { motoristaId: veiculo.motoristaId } });

  // Traça o caminho do motorista até o endereço do próprio responsável —
  // só faz sentido calcular se temos as duas pontas: a posição atual do
  // motorista e o endereço do responsável já geocodificado (ver
  // src/app/responsavel/endereco). Sem uma das duas, não desenha rota
  // nenhuma, só o marcador do veículo (comportamento de antes).
  let rota: RotaAteResponsavel | null = null;

  if (localizacao && responsavel.enderecoLatitude !== null && responsavel.enderecoLongitude !== null) {
    const destino = { latitude: responsavel.enderecoLatitude, longitude: responsavel.enderecoLongitude };
    const resultado = await calcularRotaSimples(
      { latitude: localizacao.latitude, longitude: localizacao.longitude },
      destino
    );
    if (resultado) {
      rota = {
        destino,
        distanciaMetros: resultado.distanciaMetros,
        duracaoSegundos: resultado.duracaoSegundos,
        // GeoJSON vem como [lon, lat] — Leaflet espera [lat, lon].
        geometria: resultado.geometria.coordinates.map(([lon, lat]) => [lat, lon]),
      };
    }
  }

  return NextResponse.json({
    veiculo: { placa: veiculo.placa, modelo: veiculo.modelo },
    motorista: { nome: veiculo.motorista.nome },
    localizacao: localizacao
      ? {
          latitude: localizacao.latitude,
          longitude: localizacao.longitude,
          atualizadoEm: localizacao.atualizadoEm,
          desatualizada: isLocationStale(localizacao.atualizadoEm),
        }
      : null,
    rota,
  });
}
