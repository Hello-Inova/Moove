import "server-only";

// Geocodificação de endereço → coordenadas via Nominatim (OpenStreetMap),
// mesmo provedor gratuito já usado para os tiles do mapa (Leaflet). Uso
// baixo volume (só no cadastro/edição de endereço do responsável, nunca em
// tempo real) — dentro da política de uso justo do serviço público
// (https://operations.osmfoundation.org/policies/nominatim/): no máximo
// 1 req/s, com um User-Agent identificando a aplicação.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult = { latitude: number; longitude: number };

function userAgent(): string {
  const contato = process.env.EMAIL_FROM || process.env.ADMIN_EMAIL || "contato@moove.app";
  return `Moove/1.0 (${contato})`;
}

/**
 * Geocodifica um endereço textual (rua, número, bairro, cidade, estado)
 * para latitude/longitude. Retorna `null` se o endereço não for encontrado
 * ou se o serviço falhar — geocodificação nunca deve travar um fluxo maior
 * (cadastro, edição de perfil): o chamador decide como lidar com `null`.
 */
export async function geocodeEndereco(enderecoTexto: string): Promise<GeocodeResult | null> {
  const texto = enderecoTexto.trim();
  if (!texto) return null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", texto);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": userAgent(), "Accept-Language": "pt-BR" },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Array<{ lat: string; lon: string }>;
    const primeiro = data[0];
    if (!primeiro) return null;

    const latitude = Number(primeiro.lat);
    const longitude = Number(primeiro.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return { latitude, longitude };
  } catch {
    // Timeout, rede fora do ar, resposta inesperada — trata como "não
    // encontrado" em vez de propagar erro.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Monta a string de endereço padrão usada tanto para geocodificar quanto
 * para exibir na UI (lista de paradas do motorista, tela de perfil). */
export function montarEnderecoTexto(endereco: {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}): string {
  const linha1 = [endereco.logradouro, endereco.numero].filter(Boolean).join(", ");
  const linha2 = [endereco.bairro, endereco.cidade, endereco.estado].filter(Boolean).join(", ");
  return [linha1, linha2].filter(Boolean).join(" — ");
}
