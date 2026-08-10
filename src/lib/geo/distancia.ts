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
