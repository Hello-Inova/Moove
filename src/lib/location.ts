/**
 * O motorista atualiza sua localização a cada 10-15s enquanto compartilha
 * (ver hook useLocationSharing). Se a última atualização for mais antiga que
 * este limite, tratamos como "desatualizada" no mapa do responsável — o GPS
 * pode ter sido desligado, a aba minimizada (iOS/Safari suspende a aba em
 * segundo plano) ou a conexão caiu.
 */
export const LOCATION_STALE_SECONDS = 45;

export function isLocationStale(atualizadoEm: Date): boolean {
  return Date.now() - atualizadoEm.getTime() > LOCATION_STALE_SECONDS * 1000;
}
