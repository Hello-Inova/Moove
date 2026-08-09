import "server-only";

// Geocodificação de endereço → coordenadas.
//
// Provedor principal: LocationIQ (https://locationiq.com), gratuito até
// 5.000 requisições/dia, com API compatível com o Nominatim (mesmos nomes
// de parâmetro: street/city/state/postalcode/country, ou `q=` livre).
// Precisa da env var LOCATIONIQ_API_KEY.
//
// Por que trocar do Nominatim público direto: em produção (servidor da
// Vercel), o Nominatim público estava devolvendo lista vazia mesmo pra
// buscas em texto livre de endereços válidos — comportamento típico de
// bloqueio/limitação de IPs de datacenter/nuvem pela política de uso
// justo do serviço (https://operations.osmfoundation.org/policies/nominatim/).
// O LocationIQ é pensado justamente para uso de servidor/produção.
//
// Mantemos o Nominatim como fallback final (sem key nenhuma) caso o
// LOCATIONIQ_API_KEY não esteja configurado ou o LocationIQ também falhe.

const LOCATIONIQ_URL = "https://us1.locationiq.com/v1/search";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export type GeocodeResult = { latitude: number; longitude: number };

// Resultado interno com o texto do lugar encontrado — usado só para a
// checagem de sanidade (bate com a cidade pedida?) antes de aceitar a
// coordenada; não é exposto pra fora de geocodeEndereco.
type ResultadoBruto = GeocodeResult & { displayName: string };

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

async function buscarEm(
  provedor: "locationiq" | "nominatim",
  baseUrl: string,
  params: Record<string, string>,
  extraSearchParams?: Record<string, string>,
  format: string = "jsonv2"
): Promise<ResultadoBruto | null> {
  const url = new URL(baseUrl);
  url.searchParams.set("format", format);
  url.searchParams.set("limit", "1");
  for (const [chave, valor] of Object.entries(params)) {
    if (valor) url.searchParams.set(chave, valor);
  }
  if (extraSearchParams) {
    for (const [chave, valor] of Object.entries(extraSearchParams)) {
      url.searchParams.set(chave, valor);
    }
  }

  // URL só pra log — sem a key, pra não vazar ela nos Runtime Logs.
  const urlParaLog = new URL(url.toString());
  urlParaLog.searchParams.delete("key");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": userAgent(), "Accept-Language": "pt-BR" },
      signal: controller.signal,
    });

    if (!response.ok) {
      // Loga no servidor (visível nos Runtime Logs da Vercel). O corpo de
      // erro do LocationIQ vem em XML com o motivo em <error>...</error>
      // (ou <message>) — extraímos isso e colocamos ANTES da URL na
      // mensagem de log, porque o Vercel trunca linhas de log longas e a
      // URL (bem maior) estava "empurrando" a parte que importa pra fora.
      const corpo = await response.text().catch(() => "");
      const motivo = corpo.match(/<error[^>]*>([\s\S]*?)<\/error>/i)?.[1]?.trim()
        ?? corpo.match(/<message[^>]*>([\s\S]*?)<\/message>/i)?.[1]?.trim()
        ?? corpo.slice(0, 200);
      console.warn(
        `[geocoding:${provedor}] ${response.status} ${response.statusText} — motivo:`,
        motivo,
        "| url:",
        urlParaLog.toString()
      );
      return null;
    }

    const data = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    const primeiro = data[0];
    if (!primeiro) {
      console.warn(`[geocoding:${provedor}] não encontrou resultado para`, urlParaLog.toString());
      return null;
    }

    const latitude = Number(primeiro.lat);
    const longitude = Number(primeiro.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    // Loga sucesso também — sem isso não dava pra saber qual das 3 etapas
    // (estruturada+CEP / estruturada sem CEP / texto livre) resolveu, nem
    // conferir se o lugar encontrado ("display_name" do OSM) bate com o
    // endereço pedido. Essencial pra diagnosticar "salvou mas caiu longe".
    console.info(
      `[geocoding:${provedor}] encontrado ${latitude},${longitude} —`,
      primeiro.display_name ?? "(sem display_name)",
      "| url:",
      urlParaLog.toString()
    );

    return { latitude, longitude, displayName: primeiro.display_name ?? "" };
  } catch (err) {
    // Timeout, rede fora do ar, resposta inesperada — trata como "não
    // encontrado" em vez de propagar erro, mas loga a causa real.
    console.warn(`[geocoding:${provedor}] falha ao consultar`, urlParaLog.toString(), err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function buscarLocationIq(params: Record<string, string>): Promise<ResultadoBruto | null> {
  const keyBruta = process.env.LOCATIONIQ_API_KEY;
  if (!keyBruta) return null;

  // Copiar a key com aspas/espaço junto (comum ao colar em variável de
  // ambiente) faz a API rejeitar a requisição inteira com "Invalid Request"
  // — mais barato checar isso aqui e avisar do que descobrir só pelo log.
  const key = keyBruta.trim().replace(/^['"]|['"]$/g, "");
  if (key !== keyBruta) {
    console.warn(
      `[geocoding:locationiq] LOCATIONIQ_API_KEY tinha espaços/aspas sobrando — usando versão limpa (${key.length} caracteres, original tinha ${keyBruta.length}).`
    );
  }

  // O plano gratuito do LocationIQ não aceita format=jsonv2 no endpoint
  // /search (retorna 400 "Invalid Request" genérico) — só json/xml.
  return buscarEm("locationiq", LOCATIONIQ_URL, params, { key }, "json");
}

async function buscarNominatim(params: Record<string, string>): Promise<ResultadoBruto | null> {
  return buscarEm("nominatim", NOMINATIM_URL, params);
}

/**
 * Tenta o LocationIQ primeiro (se houver API key configurada) e só cai
 * pro Nominatim público se o LocationIQ não estiver configurado ou não
 * encontrar nada — mantém uma segunda chance gratuita sem depender de key.
 */
async function buscar(params: Record<string, string>): Promise<ResultadoBruto | null> {
  const viaLocationIq = await buscarLocationIq(params);
  if (viaLocationIq) return viaLocationIq;
  return buscarNominatim(params);
}

// Remove acentos/maiúsculas pra comparar nomes de cidade sem depender de
// grafia idêntica ("São Paulo" vs "Sao Paulo").
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acentuação combinantes
    .toLowerCase()
    .trim();
}

/**
 * Checagem de sanidade: o provedor de geocodificação (LocationIQ/Nominatim)
 * pode devolver "sucesso" com um resultado de outra cidade completamente —
 * já aconteceu de pedir "Cajamar" e vir "Avenida Higienópolis, Consolação,
 * São Paulo capital". Isso não é erro de rede/formato (a API responde 200
 * com um resultado válido), é o provedor "chutando" o resultado mais
 * próximo que achou. Sem essa checagem, salvamos coordenada de um endereço
 * errado sem avisar ninguém — pior do que não ter coordenada nenhuma.
 */
function cidadeBate(resultado: ResultadoBruto, cidadeEsperada: string): boolean {
  if (!resultado.displayName) return true; // sem texto pra checar, aceita
  return normalizar(resultado.displayName).includes(normalizar(cidadeEsperada));
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
function formatarCepComHifen(cep: string): string {
  const digitos = cep.replace(/\D/g, "");
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : cep;
}

export async function geocodeEndereco(endereco: EnderecoParaGeocodificar): Promise<GeocodeResult | null> {
  const rua = endereco.logradouro.trim();
  const numero = endereco.numero.trim();
  if (!rua) return null;

  const ruaComNumero = numero ? `${numero} ${rua}` : rua;
  const estado = nomeEstado(endereco.estado);

  // 1) Busca estruturada com CEP — a mais precisa quando bate certinho com
  // o formato indexado no OpenStreetMap (com hífen).
  const comCep = await buscar({
    street: ruaComNumero,
    city: endereco.cidade,
    state: estado,
    postalcode: formatarCepComHifen(endereco.cep),
    country: "Brazil",
  });
  if (comCep && cidadeBate(comCep, endereco.cidade)) {
    console.info("[geocoding] resolvido na ETAPA 1 (estruturada + CEP) — a mais precisa");
    return comCep;
  }
  if (comCep) {
    console.warn(
      `[geocoding] ETAPA 1 descartada: provedor devolveu um lugar de outra cidade ("${comCep.displayName}", esperado "${endereco.cidade}") — tentando próxima etapa.`
    );
  }

  // 2) Busca estruturada sem CEP — o formato/indexação do CEP no OSM varia
  // bastante no Brasil; exigir esse campo às vezes zera resultados que
  // existiriam só com rua+número+cidade+estado.
  const semCep = await buscar({
    street: ruaComNumero,
    city: endereco.cidade,
    state: estado,
    country: "Brazil",
  });
  if (semCep && cidadeBate(semCep, endereco.cidade)) {
    console.info("[geocoding] resolvido na ETAPA 2 (estruturada sem CEP) — precisa, mas sem checagem do CEP");
    return semCep;
  }
  if (semCep) {
    console.warn(
      `[geocoding] ETAPA 2 descartada: provedor devolveu um lugar de outra cidade ("${semCep.displayName}", esperado "${endereco.cidade}") — tentando próxima etapa.`
    );
  }

  // 3) Texto livre como último recurso — menos preciso pro número exato,
  // mas melhor do que não ter coordenada nenhuma.
  const textoLivre = [ruaComNumero, endereco.bairro, endereco.cidade, estado, endereco.cep, "Brasil"]
    .filter(Boolean)
    .join(", ");

  const viaTextoLivre = await buscar({ q: textoLivre, countrycodes: "br" });
  if (viaTextoLivre && cidadeBate(viaTextoLivre, endereco.cidade)) {
    console.warn(
      "[geocoding] resolvido na ETAPA 3 (texto livre) — MENOS CONFIÁVEL pro número exato, mas cidade confere."
    );
    return viaTextoLivre;
  }
  if (viaTextoLivre) {
    console.warn(
      `[geocoding] ETAPA 3 descartada: provedor devolveu um lugar de outra cidade ("${viaTextoLivre.displayName}", esperado "${endereco.cidade}"). Nenhuma etapa encontrou coordenada confiável — endereço fica sem geocodificação.`
    );
  }
  return null;
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
