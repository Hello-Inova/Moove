import "server-only";

// Geocodificação de endereço → coordenadas via Nominatim (OpenStreetMap),
// mesmo provedor gratuito já usado para os tiles do mapa (Leaflet). Uso
// baixo volume (só no cadastro/edição de endereço do responsável, nunca em
// tempo real) — dentro da política de uso justo do serviço público
// (https://operations.osmfoundation.org/policies/nominatim/): no máximo
// 1 req/s, com um User-Agent identificando a aplicação.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult = { latitude: number; longitude: number };

export type EnderecoParaGeocodificar = {
  logradouro: string;
  numero: string;
  bairro?: string | null;
  cidade: string;
  estado: string;
  cep: string;
};

// O Nominatim casa o parâmetro estruturado `state` contra o nome da divisão
// administrativa no OpenStreetMap ("São Paulo"), não a sigla ("SP") — uma
// busca estruturada com a sigla direto tende a não encontrar nada e cair
// sempre no fallback de texto livre. Convertendo pro nome completo, a busca
// estruturada (mais precisa pro número da casa) funciona na maioria das vezes.
const NOME_ESTADO: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

function nomeEstado(uf: string): string {
  return NOME_ESTADO[uf.trim().toUpperCase()] ?? uf;
}

function userAgent(): string {
  const contato = process.env.EMAIL_FROM || process.env.ADMIN_EMAIL || "contato@moove.app";
  return `Moove/1.0 (${contato})`;
}

async function buscarNominatim(params: Record<string, string>): Promise<GeocodeResult | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  for (const [chave, valor] of Object.entries(params)) {
    if (valor) url.searchParams.set(chave, valor);
  }

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

/**
 * Geocodifica um endereço (rua, número, bairro, cidade, UF, CEP) para
 * latitude/longitude, priorizando a precisão no número exato — é o que
 * localiza o motorista na casa certa, não só na rua.
 *
 * Usa a busca **estruturada** do Nominatim (`street`/`city`/`state`/
 * `postalcode`, um campo por parte do endereço) em vez de uma frase livre:
 * o parser de texto livre do Nominatim frequentemente erra qual token é o
 * número da casa quando o endereço vem como uma única string, e nesse caso
 * ele "recua" para o centro da rua ou do bairro — exatamente o sintoma
 * relatado (chega na rua certa, mas não no número certo).
 *
 * Se a busca estruturada não encontrar nada (acontece com alguma frequência
 * no Brasil, já que a malha de numeração de casas no OpenStreetMap ainda é
 * incompleta fora dos grandes centros), cai para uma busca em texto livre
 * como segunda tentativa — melhor uma localização aproximada (nível de rua)
 * do que nenhuma.
 */
export async function geocodeEndereco(endereco: EnderecoParaGeocodificar): Promise<GeocodeResult | null> {
  const rua = endereco.logradouro.trim();
  const numero = endereco.numero.trim();
  if (!rua) return null;

  const estruturado = await buscarNominatim({
    street: numero ? `${numero} ${rua}` : rua,
    city: endereco.cidade,
    state: nomeEstado(endereco.estado),
    postalcode: endereco.cep,
    country: "Brazil",
  });
  if (estruturado) return estruturado;

  const textoLivre = [
    rua && numero ? `${rua}, ${numero}` : rua,
    endereco.bairro,
    endereco.cidade,
    nomeEstado(endereco.estado),
    endereco.cep,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");

  return buscarNominatim({ q: textoLivre, countrycodes: "br" });
}

/** Monta a string de endereço padrão usada para exibir na UI (lista de
 * paradas do motorista, tela de perfil) — não é mais usada para
 * geocodificar (ver `geocodeEndereco`, que usa busca estruturada). */
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
