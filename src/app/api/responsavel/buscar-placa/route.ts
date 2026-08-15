import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { buscarPlacaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { isLocationStale } from "@/lib/location";
import { calcularRotaSimples } from "@/lib/routing/osrm";
import { haversineMetros } from "@/lib/geo/distancia";

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

// O mapa do responsável faz polling desta rota a cada 10s enquanto a tela
// fica aberta (ver BuscarPlacaClient) — recalcular o trajeto no OSRM
// (serviço público, de uso justo limitado) a cada um desses ciclos, para
// cada responsável olhando o mapa ao mesmo tempo, é pesado demais e ainda
// arrisca deixar a resposta lenta bem na hora que mais importa ser rápida
// (o carro se movendo). Como o traçado da rua muda pouco de um poll pro
// outro, só recalculamos quando o motorista andou uma distância relevante
// ou o cache ficou velho — o resto do tempo só repetimos o último traçado
// já calculado, e a resposta fica rápida (só leitura no banco). Cache em
// memória por instância — reseta em cold start, o que é inofensivo (só
// recalcula uma vez a mais).
//
// Mesmas três regras do recálculo automático no app do motorista (ver
// RECALCULO_* em RotaPanel.tsx) — combinadas do mesmo jeito: nunca
// recalcula antes do cooldown, e dentro dele só recalcula de fato quando o
// motorista andou a distância mínima OU o teto de tempo estourou.
const RECALCULO_DISTANCIA_MINIMA_M = 100;
const RECALCULO_COOLDOWN_MS = 30_000;
const RECALCULO_TETO_MS = 60_000;
const rotaCache = new Map<
  string,
  { calculadoEm: number; origem: { latitude: number; longitude: number }; rota: RotaAteResponsavel | null }
>();

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

  // Se o responsável tem mais de um filho vinculado a este mesmo motorista,
  // pega o vínculo ATIVO mais antigo — mesma ambiguidade que já existia
  // aqui antes (esta busca sempre resolveu "o" vínculo entre o par
  // responsável/motorista, nunca soube distinguir qual filho); o endereço
  // usado agora é o desse aluno específico, não mais um endereço único
  // compartilhado entre os irmãos.
  const vinculo = await prisma.vinculo.findFirst({
    where: { motoristaId: veiculo.motoristaId, responsavelId: responsavel.id, status: "ATIVO" },
    orderBy: { criadoEm: "asc" },
    include: { aluno: { select: { id: true, enderecoLatitude: true, enderecoLongitude: true } } },
  });
  if (!vinculo) {
    return jsonError(
      403,
      "Você não tem vínculo ativo com o motorista deste veículo. Peça um código de convite a ele."
    );
  }

  const localizacao = await prisma.localizacao.findUnique({ where: { motoristaId: veiculo.motoristaId } });

  // Traça o caminho do motorista até o endereço do aluno (não mais do
  // responsável — cada filho pode ter um endereço diferente, ver Aluno no
  // schema) — só faz sentido calcular se temos as duas pontas: a posição
  // atual do motorista e o endereço do aluno já geocodificado. Sem uma das
  // duas, não desenha rota nenhuma, só o marcador do veículo (comportamento
  // de antes).
  let rota: RotaAteResponsavel | null = null;

  if (localizacao && vinculo.aluno.enderecoLatitude !== null && vinculo.aluno.enderecoLongitude !== null) {
    const destino = { latitude: vinculo.aluno.enderecoLatitude, longitude: vinculo.aluno.enderecoLongitude };
    const origem = { latitude: localizacao.latitude, longitude: localizacao.longitude };
    const chaveCache = `${veiculo.motoristaId}:${vinculo.aluno.id}`;
    const emCache = rotaCache.get(chaveCache);

    const desdeUltimoCalculo = emCache ? Date.now() - emCache.calculadoEm : Infinity;
    const distanciaPercorrida = emCache ? haversineMetros(emCache.origem, origem) : Infinity;

    const podeReaproveitar =
      !!emCache &&
      (desdeUltimoCalculo < RECALCULO_COOLDOWN_MS ||
        (distanciaPercorrida < RECALCULO_DISTANCIA_MINIMA_M && desdeUltimoCalculo < RECALCULO_TETO_MS));

    if (podeReaproveitar) {
      rota = emCache.rota;
    } else {
      // Timeout curto (4s, não os 10s padrão) — isso aqui roda dentro do
      // caminho de polling a cada 10s; se o OSRM travar, preferimos devolver
      // rápido só com a posição do carro (sem o traçado) a segurar a
      // resposta inteira e atrasar a atualização do marcador no mapa.
      const resultado = await calcularRotaSimples(origem, destino, 4_000);
      if (resultado) {
        rota = {
          destino,
          distanciaMetros: resultado.distanciaMetros,
          duracaoSegundos: resultado.duracaoSegundos,
          // GeoJSON vem como [lon, lat] — Leaflet espera [lat, lon].
          geometria: resultado.geometria.coordinates.map(([lon, lat]) => [lat, lon]),
        };
      }
      rotaCache.set(chaveCache, { calculadoEm: Date.now(), origem, rota });
    }
  }

  return NextResponse.json(
    {
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
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
