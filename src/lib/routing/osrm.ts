import "server-only";

// Cálculo de rota otimizada multi-parada via OSRM (Open Source Routing
// Machine), usando o servidor de demonstração público
// (https://router.project-osrm.org) — mesma filosofia "sem chave paga" do
// resto do projeto (Leaflet + OpenStreetMap). O serviço "trip" resolve o
// problema de "visitar N paradas na ordem mais eficiente a partir de um
// ponto de partida fixo" (variante do caixeiro-viajante), que é exatamente
// o que a rota do motorista precisa: começar na posição atual dele e
// visitar os endereços dos alunos vinculados na ordem mais curta, sem
// precisar voltar ao ponto de partida.
//
// Uso baixo volume por natureza (só quando o motorista inicia a rota,
// recalcula manualmente, ou marca uma parada como concluída — nunca a cada
// atualização de GPS), dentro do uso justo esperado do servidor público.
// Para volume alto em produção, trocar por um OSRM próprio (Docker) ou por
// um provedor pago (Mapbox, Google) é a evolução natural.

const OSRM_TRIP_URL = "https://router.project-osrm.org/trip/v1/driving/";
const OSRM_ROUTE_URL = "https://router.project-osrm.org/route/v1/driving/";

export type Ponto = { latitude: number; longitude: number };

export type RotaOtimizada = {
  /** Índices de `pontos` (o array de entrada) na ordem de visita — sempre
   * começa em 0 (a posição do motorista, o ponto de partida fixo). */
  ordem: number[];
  distanciaMetros: number;
  duracaoSegundos: number;
  /** GeoJSON LineString (coordenadas [lon, lat]) pronto para desenhar no
   * Leaflet — precisa inverter para [lat, lon] na hora de renderizar. */
  geometria: { type: "LineString"; coordinates: [number, number][] };
};

/**
 * `pontos[0]` deve ser sempre a posição atual do motorista (ponto de
 * partida fixo); os demais são as paradas a visitar, em qualquer ordem —
 * o OSRM decide a ordem mais eficiente. Retorna `null` se não houver
 * paradas suficientes (menos de 2 pontos) ou se o serviço falhar/não
 * encontrar rota (ex: coordenada isolada sem via mapeada perto).
 */
export async function calcularRotaOtimizada(pontos: Ponto[]): Promise<RotaOtimizada | null> {
  if (pontos.length < 2) return null;

  const coordenadas = pontos.map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(";");

  const url = new URL(OSRM_TRIP_URL + coordenadas);
  url.searchParams.set("source", "first");
  url.searchParams.set("roundtrip", "false");
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      code: string;
      trips?: Array<{
        distance: number;
        duration: number;
        geometry: { type: "LineString"; coordinates: [number, number][] };
      }>;
      waypoints?: Array<{ waypoint_index: number }>;
    };

    if (data.code !== "Ok" || !data.trips?.[0] || !data.waypoints) return null;

    const trip = data.trips[0];

    // `waypoints[i]` corresponde ao ponto de entrada `pontos[i]`, e seu
    // `waypoint_index` é a posição dele na rota otimizada — invertemos para
    // obter, na ordem de visita, o índice original de cada parada.
    const ordem = data.waypoints
      .map((wp, indiceOriginal) => ({ indiceOriginal, posicao: wp.waypoint_index }))
      .sort((a, b) => a.posicao - b.posicao)
      .map((w) => w.indiceOriginal);

    return {
      ordem,
      distanciaMetros: trip.distance,
      duracaoSegundos: trip.duration,
      geometria: trip.geometry,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export type RotaSimples = {
  distanciaMetros: number;
  duracaoSegundos: number;
  /** GeoJSON LineString (coordenadas [lon, lat]) — inverter para [lat, lon]
   * na hora de renderizar no Leaflet, igual à `RotaOtimizada`. */
  geometria: { type: "LineString"; coordinates: [number, number][] };
};

/**
 * Traçado simples entre dois pontos (sem otimização de paradas) — usado no
 * mapa do responsável pra desenhar o caminho do motorista até o endereço
 * dele, ao contrário de `calcularRotaOtimizada` (mapa do motorista, que
 * visita vários alunos). Usa o serviço `route` do OSRM em vez de `trip`.
 */
export async function calcularRotaSimples(origem: Ponto, destino: Ponto): Promise<RotaSimples | null> {
  const coordenadas = [origem, destino]
    .map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`)
    .join(";");

  const url = new URL(OSRM_ROUTE_URL + coordenadas);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      code: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { type: "LineString"; coordinates: [number, number][] };
      }>;
    };

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const rota = data.routes[0];
    return { distanciaMetros: rota.distance, duracaoSegundos: rota.duration, geometria: rota.geometry };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
