import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { montarEnderecoTexto } from "@/lib/geocoding";
import { calcularRotaSimples } from "@/lib/routing/osrm";
import { calcularRotaSimplesGoogle } from "@/lib/routing/google-directions";

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
 * Lista os alunos (vínculos ATIVOS) do motorista, com a posição do aluno
 * geocodificada, pra desenhar os balões no mapa e a lista com o botão
 * "Ir" (ver RotaPanel.tsx). NÃO pré-calcula mais um trajeto multi-parada
 * otimizado via OSRM — só marca no mapa onde o motorista está (balão azul,
 * posição ao vivo do GPS) e onde cada aluno está (balão laranja, com as
 * iniciais do nome). O motorista escolhe manualmente pra qual aluno ir
 * (botão "Ir" de cada item), e só nesse momento uma rota de verdade é
 * calculada — ver `rotaAteVinculo` abaixo.
 *
 * Com `?escolaId=`, traça direto até uma escola. Com `?vinculoId=`, traça
 * direto até UM aluno específico — usado quando o motorista escolhe, na
 * lista, pra qual quer ir (botão "Ir"). Em ambos os casos o alerta de
 * proximidade automático (`/api/motorista/localizacao`) não muda —
 * continua avaliando todos os vínculos ativos pela config do motorista,
 * independente de qual destino está em foco no mapa.
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

  const comEndereco = vinculos
    .filter((v) => v.aluno.enderecoLatitude !== null && v.aluno.enderecoLongitude !== null)
    // Sem rota otimizada não há mais uma "ordem de visita" — lista em ordem
    // alfabética só pra ficar estável e previsível pro motorista.
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome, "pt-BR"));
  const vinculosSemEndereco = vinculos.length - comEndereco.length;

  const paradas: ParadaRota[] = comEndereco.map((vinculo, posicao) => ({
    vinculoId: vinculo.id,
    sequencia: posicao + 1,
    alunoNome: vinculo.aluno.nome,
    responsavelNome: vinculo.responsavel.nome,
    enderecoResumo: montarEnderecoTexto(vinculo.aluno),
    latitude: vinculo.aluno.enderecoLatitude as number,
    longitude: vinculo.aluno.enderecoLongitude as number,
  }));

  return NextResponse.json({
    motorista: { latitude: localizacao.latitude, longitude: localizacao.longitude },
    paradas,
    distanciaMetros: null,
    duracaoSegundos: null,
    geometria: null,
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
