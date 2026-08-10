import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { montarEnderecoTexto } from "@/lib/geocoding";
import { calcularRotaOtimizada, calcularRotaSimples } from "@/lib/routing/osrm";

export type ParadaRota = {
  vinculoId: string;
  sequencia: number;
  alunoNome: string;
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
  /** Preenchido só quando a rota é "ir até uma escola" (?escolaId=), pra a
   * UI saber que está num modo diferente do normal (todos os alunos). */
  modoEscola: { escolaId: string; nome: string } | null;
};

/**
 * Rota otimizada do motorista: a partir da posição atual dele (GPS), traça
 * o trajeto mais eficiente passando pelo endereço de cada responsável com
 * vínculo ATIVO (ver regra de negócio equivalente em
 * `GET /api/responsavel/buscar-placa` — aqui o filtro é o inverso: todos
 * os vínculos ativos do motorista autenticado).
 *
 * Com `?escolaId=`, ignora os alunos e traça direto até aquela escola —
 * usado quando o motorista quer ir para uma escola mesmo sem ter
 * terminado de coletar todos os alunos (ver RotaPanel.tsx).
 *
 * Não é chamado a cada atualização de GPS — só quando o motorista inicia a
 * rota, pede pra recalcular, ou marca uma parada como concluída (ver
 * `RotaMapa.tsx`), para respeitar o uso justo do servidor público do OSRM.
 */
export async function GET(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const localizacao = await prisma.localizacao.findUnique({ where: { motoristaId: motorista.id } });
  if (!localizacao) {
    return jsonError(409, "Ative o compartilhamento de localização primeiro — a rota parte da sua posição atual.");
  }

  const escolaId = request.nextUrl.searchParams.get("escolaId");
  if (escolaId) {
    return rotaAteEscola(motorista.id, escolaId, localizacao);
  }

  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId: motorista.id, status: "ATIVO" },
    include: {
      aluno: { select: { nome: true } },
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
      modoEscola: null,
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
        alunoNome: vinculo.aluno.nome,
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
    modoEscola: null,
  } satisfies RotaResponse);
}

async function rotaAteEscola(
  motoristaId: string,
  escolaId: string,
  localizacao: { latitude: number; longitude: number }
) {
  const escola = await prisma.escola.findUnique({ where: { id: escolaId } });
  if (!escola || escola.motoristaId !== motoristaId) {
    return jsonError(404, "Escola não encontrada.");
  }
  if (escola.enderecoLatitude === null || escola.enderecoLongitude === null) {
    return jsonError(409, "Esta escola não tem endereço localizado no mapa — corrija em \"Minhas escolas\".");
  }

  const destino = { latitude: escola.enderecoLatitude, longitude: escola.enderecoLongitude };
  const resultado = await calcularRotaSimples(
    { latitude: localizacao.latitude, longitude: localizacao.longitude },
    destino
  );
  if (!resultado) {
    return jsonError(502, "Não foi possível calcular a rota até a escola agora. Tente novamente em instantes.");
  }

  const geometria: [number, number][] = resultado.geometria.coordinates.map(([lon, lat]) => [lat, lon]);

  return NextResponse.json({
    motorista: { latitude: localizacao.latitude, longitude: localizacao.longitude },
    paradas: [
      {
        vinculoId: `escola-${escola.id}`,
        sequencia: 1,
        alunoNome: escola.nome,
        responsavelNome: escola.nome,
        enderecoResumo: montarEnderecoTexto(escola),
        latitude: destino.latitude,
        longitude: destino.longitude,
      },
    ],
    distanciaMetros: resultado.distanciaMetros,
    duracaoSegundos: resultado.duracaoSegundos,
    geometria,
    vinculosSemEndereco: 0,
    modoEscola: { escolaId: escola.id, nome: escola.nome },
  } satisfies RotaResponse);
}
