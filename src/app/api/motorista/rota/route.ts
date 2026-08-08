import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { montarEnderecoTexto } from "@/lib/geocoding";
import { calcularRotaOtimizada } from "@/lib/routing/osrm";

export type ParadaRota = {
  vinculoId: string;
  sequencia: number;
  responsavelNome: string;
  enderecoResumo: string;
  latitude: number;
  longitude: number;
};

export type RotaResponse = {
  motorista: { latitude: number; longitude: number };
  paradas: ParadaRota[];
  distanciaMetros: number | null;
  duracaoSegundos: number | null;
  /** [lat, lon][], pronto para o Leaflet <Polyline positions={...} />. */
  geometria: [number, number][] | null;
  /** Vínculos ativos cujo responsável ainda não tem endereço geocodificado
   * — não entram na rota, mas o motorista precisa saber que existem. */
  vinculosSemEndereco: number;
};

/**
 * Rota otimizada do motorista: a partir da posição atual dele (GPS), traça
 * o trajeto mais eficiente passando pelo endereço de cada responsável com
 * vínculo ATIVO (ver regra de negócio equivalente em
 * `GET /api/responsavel/buscar-placa` — aqui o filtro é o inverso: todos
 * os vínculos ativos do motorista autenticado).
 *
 * Não é chamado a cada atualização de GPS — só quando o motorista inicia a
 * rota, pede pra recalcular, ou marca uma parada como concluída (ver
 * `RotaMapa.tsx`), para respeitar o uso justo do servidor público do OSRM.
 */
export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const localizacao = await prisma.localizacao.findUnique({ where: { motoristaId: motorista.id } });
  if (!localizacao) {
    return jsonError(409, "Ative o compartilhamento de localização primeiro — a rota parte da sua posição atual.");
  }

  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId: motorista.id, status: "ATIVO" },
    include: {
      responsavel: {
        select: {
          nome: true,
          logradouro: true,
          numero: true,
          bairro: true,
          cidade: true,
          estado: true,
          enderecoLatitude: true,
          enderecoLongitude: true,
        },
      },
    },
  });

  const comEndereco = vinculos.filter(
    (v) => v.responsavel.enderecoLatitude !== null && v.responsavel.enderecoLongitude !== null
  );
  const vinculosSemEndereco = vinculos.length - comEndereco.length;

  if (comEndereco.length === 0) {
    return NextResponse.json({
      motorista: { latitude: localizacao.latitude, longitude: localizacao.longitude },
      paradas: [],
      distanciaMetros: null,
      duracaoSegundos: null,
      geometria: null,
      vinculosSemEndereco,
    } satisfies RotaResponse);
  }

  const pontos = [
    { latitude: localizacao.latitude, longitude: localizacao.longitude },
    ...comEndereco.map((v) => ({
      latitude: v.responsavel.enderecoLatitude as number,
      longitude: v.responsavel.enderecoLongitude as number,
    })),
  ];

  const resultado = await calcularRotaOtimizada(pontos);
  if (!resultado) {
    return jsonError(502, "Não foi possível calcular a rota agora. Tente novamente em instantes.");
  }

  // `resultado.ordem` são índices em `pontos` (0 = motorista); removemos o
  // índice 0 e convertemos os demais para posição em `comEndereco`.
  const paradas: ParadaRota[] = resultado.ordem
    .filter((indice) => indice !== 0)
    .map((indice, posicao) => {
      const vinculo = comEndereco[indice - 1];
      return {
        vinculoId: vinculo.id,
        sequencia: posicao + 1,
        responsavelNome: vinculo.responsavel.nome,
        enderecoResumo: montarEnderecoTexto(vinculo.responsavel),
        latitude: vinculo.responsavel.enderecoLatitude as number,
        longitude: vinculo.responsavel.enderecoLongitude as number,
      };
    });

  const geometria: [number, number][] = resultado.geometria.coordinates.map(([lon, lat]) => [lat, lon]);

  return NextResponse.json({
    motorista: { latitude: localizacao.latitude, longitude: localizacao.longitude },
    paradas,
    distanciaMetros: resultado.distanciaMetros,
    duracaoSegundos: resultado.duracaoSegundos,
    geometria,
    vinculosSemEndereco,
  } satisfies RotaResponse);
}
