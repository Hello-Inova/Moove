import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { montarEnderecoTexto } from "@/lib/geocoding";
import { calcularRotaOtimizada, calcularRotaSimples } from "@/lib/routing/osrm";
import { calcularRotaOtimizadaGoogle, calcularRotaSimplesGoogle } from "@/lib/routing/google-directions";

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
  /** Vínculos ativos cujo aluno ainda não tem endereço geocodificado — não
   * entram na rota, mas o motorista precisa saber que existem. */
  vinculosSemEndereco: number;
  /** Preenchido só quando a rota é "ir direto" pra um destino único —
   * `?escolaId=` (uma escola) ou `?vinculoId=` (um aluno específico,
   * escolhido pelo botão "Ir" de cada item da lista) — pra a UI saber que
   * está num modo diferente do normal (todos os alunos, otimizado). */
  modoDestino: { tipo: "escola" | "aluno"; id: string; nome: string } | null;
};

/**
 * Rota otimizada do motorista: a partir da posição atual dele (GPS), traça
 * o trajeto mais eficiente passando pelo endereço de CADA ALUNO com
 * vínculo ATIVO (endereço é por aluno, não por responsável — irmãos podem
 * ter endereços diferentes; ver regra de negócio equivalente em
 * `GET /api/responsavel/buscar-placa` — aqui o filtro é o inverso: todos
 * os vínculos ativos do motorista autenticado).
 *
 * Com `?escolaId=`, ignora os alunos e traça direto até aquela escola.
 * Com `?vinculoId=`, ignora a ordem otimizada e traça direto até UM aluno
 * específico — usado quando o motorista escolhe, na lista de alunos, para
 * qual quer ir primeiro (botão "Ir", ver RotaPanel.tsx). Em ambos os casos
 * o alerta de proximidade automático (`/api/motorista/localizacao`) não
 * muda — continua avaliando todos os vínculos ativos pela config do
 * motorista, independente de qual destino está em foco no mapa.
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

  const vinculoId = request.nextUrl.searchParams.get("vinculoId");
  if (vinculoId) {
    return rotaAteVinculo(motorista.id, vinculoId, localizacao);
  }

  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId: motorista.id, status: "ATIVO" },
    include: {
      aluno: {
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
      responsavel: { select: { nome: true } },
    },
  });

  const comEndereco = vinculos.filter(
    (v) => v.aluno.enderecoLatitude !== null && v.aluno.enderecoLongitude !== null
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
      modoDestino: null,
    } satisfies RotaResponse);
  }

  const pontos = [
    { latitude: localizacao.latitude, longitude: localizacao.longitude },
    ...comEndereco.map((v) => ({
      latitude: v.aluno.enderecoLatitude as number,
      longitude: v.aluno.enderecoLongitude as number,
    })),
  ];

  let resultado = await calcularRotaOtimizada(pontos);
  if (!resultado) {
    // OSRM (gratuito) falhou — tenta o fallback pago (Google Routes API),
    // só aqui no painel do motorista (nunca no polling do responsável).
    resultado = await calcularRotaOtimizadaGoogle(pontos);
  }
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
        enderecoResumo: montarEnderecoTexto(vinculo.aluno),
        latitude: vinculo.aluno.enderecoLatitude as number,
        longitude: vinculo.aluno.enderecoLongitude as number,
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
    modoDestino: null,
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
  const origem = { latitude: localizacao.latitude, longitude: localizacao.longitude };
  let resultado = await calcularRotaSimples(origem, destino);
  if (!resultado) {
    // OSRM (gratuito) falhou — tenta o fallback pago (Google Routes API),
    // só aqui no painel do motorista (nunca no polling do responsável).
    resultado = await calcularRotaSimplesGoogle(origem, destino);
  }
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
    modoDestino: { tipo: "escola", id: escola.id, nome: escola.nome },
  } satisfies RotaResponse);
}

/**
 * Rota direta até UM aluno específico (destino escolhido manualmente pelo
 * motorista via botão "Ir" — ver RotaPanel.tsx), ignorando a ordem
 * otimizada dos demais. Mesma lógica de `rotaAteEscola`, só que o destino é
 * o endereço geocodificado do aluno em vez do endereço da escola.
 */
async function rotaAteVinculo(
  motoristaId: string,
  vinculoId: string,
  localizacao: { latitude: number; longitude: number }
) {
  const vinculo = await prisma.vinculo.findUnique({
    where: { id: vinculoId },
    include: {
      aluno: {
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
      responsavel: { select: { nome: true } },
    },
  });
  if (!vinculo || vinculo.motoristaId !== motoristaId || vinculo.status !== "ATIVO") {
    return jsonError(404, "Vínculo não encontrado.");
  }
  if (vinculo.aluno.enderecoLatitude === null || vinculo.aluno.enderecoLongitude === null) {
    return jsonError(409, "Este aluno ainda não tem endereço localizado no mapa.");
  }

  const destino = { latitude: vinculo.aluno.enderecoLatitude, longitude: vinculo.aluno.enderecoLongitude };
  const origem = { latitude: localizacao.latitude, longitude: localizacao.longitude };
  let resultado = await calcularRotaSimples(origem, destino);
  if (!resultado) {
    // OSRM (gratuito) falhou — tenta o fallback pago (Google Routes API),
    // só aqui no painel do motorista (nunca no polling do responsável).
    resultado = await calcularRotaSimplesGoogle(origem, destino);
  }
  if (!resultado) {
    return jsonError(502, "Não foi possível calcular a rota até esse aluno agora. Tente novamente em instantes.");
  }

  const geometria: [number, number][] = resultado.geometria.coordinates.map(([lon, lat]) => [lat, lon]);

  return NextResponse.json({
    motorista: { latitude: localizacao.latitude, longitude: localizacao.longitude },
    paradas: [
      {
        vinculoId: vinculo.id,
        sequencia: 1,
        alunoNome: vinculo.aluno.nome,
        responsavelNome: vinculo.responsavel.nome,
        enderecoResumo: montarEnderecoTexto(vinculo.aluno),
        latitude: destino.latitude,
        longitude: destino.longitude,
      },
    ],
    distanciaMetros: resultado.distanciaMetros,
    duracaoSegundos: resultado.duracaoSegundos,
    geometria,
    vinculosSemEndereco: 0,
    modoDestino: { tipo: "aluno", id: vinculo.id, nome: vinculo.aluno.nome },
  } satisfies RotaResponse);
}
