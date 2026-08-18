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
  /** Vínculos ativos cujo destino (endereço do aluno na ida, escola do
   * aluno na volta) ainda não está geocodificado — não entram na rota, mas
   * o motorista precisa saber que existem. */
  vinculosSemEndereco: number;
  /** Preenchido só quando a rota é "ir direto" pra um destino único —
   * `?escolaId=` (uma escola) ou `?vinculoId=` (um aluno específico,
   * escolhido pelo botão "Ir" de cada item da lista) — pra a UI saber que
   * está num modo diferente do normal (todos os alunos, otimizado). */
  modoDestino: { tipo: "escola" | "aluno"; id: string; nome: string } | null;
};

type Sentido = "IDA" | "VOLTA";

function sentidoDaQuery(request: NextRequest): Sentido {
  return request.nextUrl.searchParams.get("sentido") === "volta" ? "VOLTA" : "IDA";
}

/** Data de hoje truncada (sem hora), em UTC — mesma convenção usada em
 * embarques_dia (ver /api/motorista/embarques). */
function hojeData(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

/**
 * Lista os alunos (vínculos ATIVOS) do motorista, com a posição de destino
 * geocodificada, pra desenhar os balões no mapa e a lista com o botão "Ir"
 * (ver RotaPanel.tsx). NÃO pré-calcula mais um trajeto multi-parada
 * otimizado via OSRM — só marca no mapa onde o motorista está (balão azul,
 * posição ao vivo do GPS) e onde cada aluno está (balão laranja, com as
 * iniciais do nome). O motorista escolhe manualmente pra qual aluno ir
 * (botão "Ir" de cada item), e só nesse momento uma rota de verdade é
 * calculada — ver `rotaAteVinculo` abaixo.
 *
 * `?sentido=volta` troca o destino de cada aluno: em vez do endereço de
 * casa (ida — padrão), usa o endereço da escola cadastrada no vínculo —
 * botão "Retorno" no painel, pra buscar os alunos nas escolas no fim do
 * dia. Com `?escolaId=`, traça direto até uma escola (independe do
 * sentido). Com `?vinculoId=`, traça direto até UM aluno específico —
 * usado quando o motorista escolhe, na lista, pra qual quer ir (botão
 * "Ir"), respeitando o sentido atual. Em todos os casos o alerta de
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

  const sentido = sentidoDaQuery(request);

  const escolaId = request.nextUrl.searchParams.get("escolaId");
  if (escolaId) {
    return rotaAteEscola(motorista.id, escolaId, localizacao);
  }

  const vinculoId = request.nextUrl.searchParams.get("vinculoId");
  if (vinculoId) {
    return rotaAteVinculo(motorista.id, vinculoId, localizacao, sentido);
  }

  if (sentido === "VOLTA") {
    return listaVolta(motorista.id, localizacao);
  }
  return listaIda(motorista.id, localizacao);
}

async function listaIda(motoristaId: string, localizacao: { latitude: number; longitude: number }) {
  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId, status: "ATIVO" },
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

/**
 * Igual `listaIda`, mas o destino de cada aluno depende da fase da volta:
 *
 * 0. Foi marcado "Ausente" hoje na IDA — não subiu no transporte de manhã,
 *    então não tem o que buscar na escola à tarde. Fica de fora do
 *    retorno inteiro (não aparece no mapa nem na lista).
 * 1. Ainda não foi buscado — destino é a escola cadastrada no vínculo
 *    (`Vinculo.escolaId`).
 * 2. Já foi marcado "Embarcou" hoje na volta (buscado na escola) — destino
 *    vira o endereço de casa dele, pra completar a entrega.
 *
 * A fase 2 é o que implementa a "entrega em casa depois de buscar na
 * escola": o motorista marca Embarcou ao pegar o aluno, e o próprio balão
 * dele no mapa (e o botão "Ir") passa a apontar pra casa a partir daí — sem
 * precisar de um terceiro status, só reaproveita a marcação que já existe.
 */
async function listaVolta(motoristaId: string, localizacao: { latitude: number; longitude: number }) {
  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId, status: "ATIVO" },
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
      escola: {
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
      // No máximo 2 registros hoje (um por sentido, chave única
      // vinculoId+data+sentido) — a IDA diz se o aluno foi buscado em casa
      // de manhã (se "Ausente", não entra no retorno — ver abaixo), a
      // VOLTA diz se já foi buscado na escola à tarde.
      embarquesDia: { where: { data: hojeData() }, select: { sentido: true, status: true } },
    },
  });

  const paradasCandidatas: Omit<ParadaRota, "sequencia">[] = [];
  let vinculosSemEndereco = 0;

  for (const vinculo of vinculos) {
    const ausenteNaIda = vinculo.embarquesDia.some((e) => e.sentido === "IDA" && e.status === "AUSENTE");
    if (ausenteNaIda) continue;

    const jaBuscado = vinculo.embarquesDia.some((e) => e.sentido === "VOLTA" && e.status === "EMBARCOU");

    if (jaBuscado) {
      if (vinculo.aluno.enderecoLatitude === null || vinculo.aluno.enderecoLongitude === null) {
        vinculosSemEndereco++;
        continue;
      }
      paradasCandidatas.push({
        vinculoId: vinculo.id,
        alunoNome: vinculo.aluno.nome,
        responsavelNome: vinculo.responsavel.nome,
        enderecoResumo: `Levar para casa — ${montarEnderecoTexto(vinculo.aluno)}`,
        latitude: vinculo.aluno.enderecoLatitude,
        longitude: vinculo.aluno.enderecoLongitude,
      });
    } else {
      if (!vinculo.escola || vinculo.escola.enderecoLatitude === null || vinculo.escola.enderecoLongitude === null) {
        vinculosSemEndereco++;
        continue;
      }
      paradasCandidatas.push({
        vinculoId: vinculo.id,
        alunoNome: vinculo.aluno.nome,
        responsavelNome: vinculo.responsavel.nome,
        enderecoResumo: `Buscar na escola (${vinculo.escola.nome}) — ${montarEnderecoTexto(vinculo.escola)}`,
        latitude: vinculo.escola.enderecoLatitude,
        longitude: vinculo.escola.enderecoLongitude,
      });
    }
  }

  paradasCandidatas.sort((a, b) => a.alunoNome.localeCompare(b.alunoNome, "pt-BR"));
  const paradas: ParadaRota[] = paradasCandidatas.map((p, posicao) => ({ ...p, sequencia: posicao + 1 }));

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
 * geocodificado por vínculo: o endereço do aluno na ida; na volta, a
 * escola cadastrada (se ainda não foi buscado hoje) ou o endereço de casa
 * (se já foi — ver mesma lógica de duas fases em `listaVolta`).
 */
async function rotaAteVinculo(
  motoristaId: string,
  vinculoId: string,
  localizacao: { latitude: number; longitude: number },
  sentido: Sentido
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
      escola: {
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
      embarquesDia: { where: { data: hojeData() }, select: { sentido: true, status: true } },
    },
  });
  if (!vinculo || vinculo.motoristaId !== motoristaId || vinculo.status !== "ATIVO") {
    return jsonError(404, "Vínculo não encontrado.");
  }

  let destino: { latitude: number; longitude: number };
  let enderecoResumo: string;
  let modoNome: string;

  if (sentido === "VOLTA") {
    const ausenteNaIda = vinculo.embarquesDia.some((e) => e.sentido === "IDA" && e.status === "AUSENTE");
    if (ausenteNaIda) {
      return jsonError(409, "Este aluno foi marcado como ausente na ida — não faz parte do retorno de hoje.");
    }

    const jaBuscado = vinculo.embarquesDia.some((e) => e.sentido === "VOLTA" && e.status === "EMBARCOU");

    if (jaBuscado) {
      if (vinculo.aluno.enderecoLatitude === null || vinculo.aluno.enderecoLongitude === null) {
        return jsonError(409, "Este aluno ainda não tem endereço localizado no mapa.");
      }
      destino = { latitude: vinculo.aluno.enderecoLatitude, longitude: vinculo.aluno.enderecoLongitude };
      enderecoResumo = `Levar para casa — ${montarEnderecoTexto(vinculo.aluno)}`;
      modoNome = `${vinculo.aluno.nome} (levar pra casa)`;
    } else {
      if (!vinculo.escola) {
        return jsonError(409, "Este aluno ainda não tem uma escola cadastrada no vínculo — defina em \"Minhas escolas\".");
      }
      if (vinculo.escola.enderecoLatitude === null || vinculo.escola.enderecoLongitude === null) {
        return jsonError(409, "A escola deste aluno ainda não tem endereço localizado no mapa.");
      }
      destino = { latitude: vinculo.escola.enderecoLatitude, longitude: vinculo.escola.enderecoLongitude };
      enderecoResumo = `Buscar na escola (${vinculo.escola.nome}) — ${montarEnderecoTexto(vinculo.escola)}`;
      modoNome = `${vinculo.aluno.nome} (buscar na ${vinculo.escola.nome})`;
    }
  } else {
    if (vinculo.aluno.enderecoLatitude === null || vinculo.aluno.enderecoLongitude === null) {
      return jsonError(409, "Este aluno ainda não tem endereço localizado no mapa.");
    }
    destino = { latitude: vinculo.aluno.enderecoLatitude, longitude: vinculo.aluno.enderecoLongitude };
    enderecoResumo = montarEnderecoTexto(vinculo.aluno);
    modoNome = vinculo.aluno.nome;
  }

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
        enderecoResumo,
        latitude: destino.latitude,
        longitude: destino.longitude,
      },
    ],
    distanciaMetros: resultado.distanciaMetros,
    duracaoSegundos: resultado.duracaoSegundos,
    geometria,
    vinculosSemEndereco: 0,
    modoDestino: { tipo: "aluno", id: vinculo.id, nome: modoNome },
  } satisfies RotaResponse);
}
