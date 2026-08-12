import "server-only";

import type { Ponto, RotaOtimizada, RotaSimples } from "@/lib/routing/osrm";
import { registrarUsoApi } from "@/lib/uso-api-externa";

// Fallback PAGO (Google Routes API v2) para o cálculo de rota — usado só
// quando o OSRM (gratuito, ver osrm.ts) falha ou não retorna resultado,
// nunca como fonte primária. Por decisão explícita do produto, esse
// fallback só é chamado a partir de `src/app/api/motorista/rota/route.ts`
// (painel do motorista) — NUNCA a partir de
// `src/app/api/responsavel/buscar-placa/route.ts` (polling frequente do
// responsável, onde o custo por chamada não compensa).
//
// Reaproveita por padrão a mesma chave de servidor da Geocoding API (basta
// habilitar também a "Routes API" no mesmo projeto do Google Cloud) — ou,
// se preferir chaves separadas por API, defina
// GOOGLE_MAPS_DIRECTIONS_API_KEY. Sem nenhuma das duas, as funções abaixo
// retornam `null` (o chamador já sabe lidar com isso — OSRM continua sendo
// obrigatório e este arquivo é 100% opcional).

const COMPUTE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

function apiKey(): string | null {
  return process.env.GOOGLE_MAPS_DIRECTIONS_API_KEY || process.env.GOOGLE_MAPS_GEOCODING_API_KEY || null;
}

function waypoint(p: Ponto) {
  return { location: { latLng: { latitude: p.latitude, longitude: p.longitude } } };
}

type ComputeRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string; // formato protobuf Duration, ex: "930s"
    polyline?: { geoJsonLinestring?: { type: "LineString"; coordinates: [number, number][] } };
    optimizedIntermediateWaypointIndex?: number[];
  }>;
};

function segundosDeDuration(duration?: string): number {
  if (!duration) return 0;
  const numero = Number.parseFloat(duration.replace(/s$/, ""));
  return Number.isFinite(numero) ? Math.round(numero) : 0;
}

async function chamarComputeRoutes(
  body: Record<string, unknown>,
  fieldMask: string,
  timeoutMs: number
): Promise<ComputeRoutesResponse | null> {
  const key = apiKey();
  if (!key) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Registrado aqui (antes do fetch) porque a chamada já consome a cota
  // gratuita do Google mesmo se der erro/timeout — só não conta se nem
  // chegou a sair (sem key configurada, já retornou acima).
  void registrarUsoApi("routes_directions");

  try {
    const response = await fetch(COMPUTE_ROUTES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as ComputeRoutesResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Equivalente a `calcularRotaSimples` (OSRM), via Google Routes API — mesma
 * assinatura e mesmo formato de retorno (GeoJSON LineString em [lon, lat],
 * pedido direto ao Google via `polylineEncoding: "GEO_JSON_LINESTRING"` pra
 * não precisar decodificar o polyline proprietário do Google).
 */
export async function calcularRotaSimplesGoogle(
  origem: Ponto,
  destino: Ponto,
  timeoutMs = 8_000
): Promise<RotaSimples | null> {
  const data = await chamarComputeRoutes(
    {
      origin: waypoint(origem),
      destination: waypoint(destino),
      travelMode: "DRIVE",
      polylineEncoding: "GEO_JSON_LINESTRING",
    },
    "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring",
    timeoutMs
  );

  const rota = data?.routes?.[0];
  const geometria = rota?.polyline?.geoJsonLinestring;
  if (!rota || !geometria || rota.distanceMeters === undefined) return null;

  return {
    distanciaMetros: rota.distanceMeters,
    duracaoSegundos: segundosDeDuration(rota.duration),
    geometria,
  };
}

/**
 * Equivalente a `calcularRotaOtimizada` (OSRM, serviço `trip`) — via Google
 * Routes API, usando `optimizeWaypointOrder` pra reordenar os
 * intermediários. Diferença importante: o `trip` do OSRM escolhe livremente
 * qual parada vira o "fim" da rota (minimizando o total); o `computeRoutes`
 * do Google exige um destino FIXO. Aqui fixamos o último ponto de `pontos`
 * como destino e otimizamos só a ordem dos demais — uma aproximação
 * razoável (não idêntica ao OSRM), aceitável por ser só um fallback
 * acionado quando o OSRM já falhou.
 */
export async function calcularRotaOtimizadaGoogle(pontos: Ponto[]): Promise<RotaOtimizada | null> {
  if (pontos.length < 2) return null;

  const [origem, ...resto] = pontos;
  const destino = resto[resto.length - 1];
  const intermediarios = resto.slice(0, -1);

  const timeoutMs = 10_000;

  if (intermediarios.length === 0) {
    // Só uma parada além do motorista — não há o que otimizar.
    const simples = await calcularRotaSimplesGoogle(origem, destino, timeoutMs);
    return simples ? { ordem: [0, 1], ...simples } : null;
  }

  const data = await chamarComputeRoutes(
    {
      origin: waypoint(origem),
      destination: waypoint(destino),
      intermediates: intermediarios.map(waypoint),
      travelMode: "DRIVE",
      polylineEncoding: "GEO_JSON_LINESTRING",
      optimizeWaypointOrder: true,
    },
    "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring,routes.optimizedIntermediateWaypointIndex",
    timeoutMs
  );

  const rota = data?.routes?.[0];
  const geometria = rota?.polyline?.geoJsonLinestring;
  if (!rota || !geometria || rota.distanceMeters === undefined) return null;

  // `optimizedIntermediateWaypointIndex` reordena só os intermediários
  // (índices 0-based dentro de `intermediarios`); reconstituímos a ordem
  // completa em índices de `pontos` (0 = motorista, último = destino fixo),
  // no mesmo formato que `calcularRotaOtimizada` (OSRM) já retorna.
  const indicesIntermediariosEmPontos = intermediarios.map((_, i) => i + 1); // pontos[1..n-1]
  const indiceDestinoEmPontos = pontos.length - 1;

  const ordemIntermediarios = rota.optimizedIntermediateWaypointIndex ?? intermediarios.map((_, i) => i);
  const ordem = [0, ...ordemIntermediarios.map((i) => indicesIntermediariosEmPontos[i]), indiceDestinoEmPontos];

  return {
    ordem,
    distanciaMetros: rota.distanceMeters,
    duracaoSegundos: segundosDeDuration(rota.duration),
    geometria,
  };
}
