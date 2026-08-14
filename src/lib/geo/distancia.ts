/**
 * Distância em linha reta (Haversine) entre duas coordenadas, em metros.
 * Usada só para estimar o ETA do alerta de proximidade — NÃO é a mesma
 * distância de rota (ruas/curvas) que o OSRM calcula em
 * `src/lib/routing/osrm.ts`. Escolhida de propósito: o alerta roda a cada
 * atualização de GPS (12 em 12s), e chamar o OSRM público nessa frequência
 * estouraria o uso justo do serviço (ver comentário em RotaPanel.tsx sobre
 * o mesmo problema). Uma estimativa em linha reta, ajustada por um fator de
 * "sinuosidade" das ruas, é suficiente para um alerta de "está chegando" —
 * não precisa ser exata ao minuto.
 */
export function haversineMetros(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000; // raio médio da Terra, em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Fator aplicado à distância em linha reta pra aproximar a distância real
// de rua (ruas raramente são retas) — 1.3 é uma aproximação comum usada em
// estimativas urbanas.
const FATOR_SINUOSIDADE = 1.3;

// Velocidade média assumida em trajeto urbano/escolar, com paradas
// frequentes — usada só pra converter distância em tempo estimado.
const VELOCIDADE_MEDIA_KMH = 22;

/** Estima o tempo (em minutos) até percorrer `distanciaMetros`, com a
 * aproximação de sinuosidade e velocidade média acima. */
export function estimarEtaMinutos(distanciaMetros: number): number {
  const distanciaAjustada = distanciaMetros * FATOR_SINUOSIDADE;
  const metrosPorMinuto = (VELOCIDADE_MEDIA_KMH * 1000) / 60;
  return distanciaAjustada / metrosPorMinuto;
}

/**
 * Distância mínima (em metros) de um ponto até uma polilinha (a geometria
 * da rota, sequência de segmentos [lat, lon]) — usada pra detectar quando o
 * motorista se afastou do traçado (ver `useDesvioTrail.ts`). Projeta os
 * pontos num plano local em metros (equirretangular, com origem no próprio
 * ponto) antes de medir a distância ponto-segmento — aproximação de sobra
 * pra escala de rua/cidade, sem o custo de uma projeção cartográfica cheia.
 */
export function distanciaAtePolilinha(
  ponto: { latitude: number; longitude: number },
  linha: [number, number][]
): number {
  if (linha.length === 0) return Infinity;
  if (linha.length === 1) {
    return haversineMetros(ponto, { latitude: linha[0][0], longitude: linha[0][1] });
  }

  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const cosLat = Math.cos(toRad(ponto.latitude));

  function paraMetros(lat: number, lon: number): [number, number] {
    const x = toRad(lon - ponto.longitude) * cosLat * R;
    const y = toRad(lat - ponto.latitude) * R;
    return [x, y];
  }

  let menor = Infinity;
  for (let i = 0; i < linha.length - 1; i++) {
    const [ax, ay] = paraMetros(linha[i][0], linha[i][1]);
    const [bx, by] = paraMetros(linha[i + 1][0], linha[i + 1][1]);

    const dx = bx - ax;
    const dy = by - ay;
    const comprimentoQuad = dx * dx + dy * dy;

    // Projeta a origem (o próprio ponto, em 0,0) no segmento a→b, limitado
    // às extremidades (t entre 0 e 1) — fórmula padrão de distância
    // ponto-segmento.
    let t = comprimentoQuad === 0 ? 0 : (-ax * dx - ay * dy) / comprimentoQuad;
    t = Math.max(0, Math.min(1, t));

    const projX = ax + t * dx;
    const projY = ay + t * dy;
    const distancia = Math.hypot(projX, projY);
    if (distancia < menor) menor = distancia;
  }

  return menor;
}
