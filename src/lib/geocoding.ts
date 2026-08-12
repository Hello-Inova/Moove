import "server-only";

import { registrarUsoApi } from "@/lib/uso-api-externa";

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
//
// Provedor OPCIONAL de última instância: Google Geocoding API (paga — ver
// GOOGLE_MAPS_GEOCODING_API_KEY). LocationIQ/Nominatim/BrasilAPI são todos,
// direta ou indiretamente, baseados no OpenStreetMap — e o mapeamento do OSM
// pra ruas internas de condomínios/loteamentos fechados no Brasil costuma
// ser incompleto. O Google tem base própria (Street View, correções de
// usuários, dados comerciais) e resolve endereços assim que as fontes
// gratuitas não conseguem. Só é chamado se a env var estiver configurada —
// sem ela, o comportamento é idêntico a antes (só fontes gratuitas).

const LOCATIONIQ_URL = "https://us1.locationiq.com/v1/search";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const BRASILAPI_CEP_URL = "https://brasilapi.com.br/api/cep/v2";
const GOOGLE_GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// `enderecoEncontrado` é o texto do lugar que o provedor efetivamente
// resolveu (ex.: "Avenida Resedá, Portais, Cajamar - SP") — mostrado na UI
// ao lado do pino pra quem cadastrou o endereço conseguir comparar rapidez
// com o que digitou, sem precisar dar zoom no mapa pra perceber um erro.
//
// `precisao` indica o quanto dá pra confiar na coordenada:
// - "alta": veio de busca ESTRUTURADA (rua+número) que o OSM conseguiu casar
//   — tende a acertar a casa, não só a rua.
// - "baixa": veio de texto livre OU do centro do CEP via BrasilAPI — essa
//   última em especial já se mostrou imprecisa na prática (o texto do
//   endereço bate, mas a coordenada pode cair em outra rua/região do CEP).
//   Endereços "baixa" precisam de confirmação manual com mais insistência.
export type GeocodeResult = {
  latitude: number;
  longitude: number;
  enderecoEncontrado?: string;
  precisao?: "alta" | "baixa";
};

// Resultado interno com o texto do lugar encontrado — usado tanto para a
// checagem de sanidade (bate com a cidade pedida?) quanto para preencher
// `enderecoEncontrado` do resultado final.
type ResultadoBruto = { latitude: number; longitude: number; displayName: string };

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

/**
 * Coordenada associada diretamente ao CEP, via BrasilAPI (agrega Correios,
 * ViaCEP e outras bases — cobertura melhor que qualquer uma isolada,
 * inclusive para CEPs de loteamentos/condomínios fechados recentes que o
 * OpenStreetMap não tem mapeado rua a rua).
 *
 * Importante: essa coordenada costuma ser do CENTRO do CEP (que pode cobrir
 * só uma rua/quadra em bairros fechados, ou uma área maior em zonas rurais),
 * não do número exato da casa — e na prática se mostrou capaz de vir com o
 * TEXTO do endereço certo (a BrasilAPI busca isso na tabela de CEPs dos
 * Correios, sempre precisa) mas a COORDENADA longe da rua real (esse campo é
 * "melhor esforço", agregado de fontes variáveis). Por isso é usada só como
 * ÚLTIMO recurso, depois de tudo mais falhar — ver ordem das etapas em
 * `geocodeEndereco`.
 */
async function buscarCoordenadaPorCep(cepDigitos: string): Promise<GeocodeResult | null> {
  if (cepDigitos.length !== 8) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  try {
    const response = await fetch(`${BRASILAPI_CEP_URL}/${cepDigitos}`, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[geocoding:brasilapi] ${response.status} para CEP ${cepDigitos}`);
      return null;
    }

    const data = (await response.json()) as {
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
    };
    const latitude = Number(data.location?.coordinates?.latitude);
    const longitude = Number(data.location?.coordinates?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
      console.warn(`[geocoding:brasilapi] CEP ${cepDigitos} sem coordenada disponível na resposta.`);
      return null;
    }

    const enderecoEncontrado = [data.street, data.neighborhood, data.city, data.state].filter(Boolean).join(", ");

    console.info(`[geocoding:brasilapi] CEP ${cepDigitos} -> ${latitude},${longitude} —`, enderecoEncontrado || "(sem detalhe)");
    return { latitude, longitude, enderecoEncontrado: enderecoEncontrado || undefined };
  } catch (err) {
    console.warn(`[geocoding:brasilapi] falha ao consultar CEP ${cepDigitos}`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Google Geocoding API — OPCIONAL, só roda se GOOGLE_MAPS_GEOCODING_API_KEY
 * estiver configurada. Paga (ver comentário no topo do arquivo), por isso só
 * é chamada depois que as buscas estruturadas gratuitas (etapas 1 e 2) já
 * falharam — é a etapa mais precisa disponível pro Brasil, incluindo
 * loteamentos/condomínios fechados que o OpenStreetMap não mapeia.
 *
 * Usa `location_type` da resposta pra saber o nível de confiança: ROOFTOP e
 * RANGE_INTERPOLATED são precisos (endereço exato ou interpolado numa faixa
 * de números); GEOMETRIC_CENTER e APPROXIMATE são mais grosseiros (centro de
 * uma região/rua) — tratados como precisão baixa igual às outras etapas
 * aproximadas.
 */
async function buscarGoogle(
  endereco: EnderecoParaGeocodificar,
  ruaComNumero: string,
  estadoPorExtenso: string
): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY;
  if (!apiKey) return null;

  const enderecoTexto = [ruaComNumero, endereco.bairro, endereco.cidade, estadoPorExtenso, formatarCepComHifen(endereco.cep), "Brasil"]
    .filter(Boolean)
    .join(", ");

  const url = new URL(GOOGLE_GEOCODING_URL);
  url.searchParams.set("address", enderecoTexto);
  url.searchParams.set("region", "br");
  url.searchParams.set("language", "pt-BR");
  url.searchParams.set("key", apiKey);

  // URL só pra log — sem a key.
  const urlParaLog = new URL(url.toString());
  urlParaLog.searchParams.delete("key");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);

  // Registrado aqui (não no `return` de sucesso) porque a chamada já
  // consome a cota gratuita do Google mesmo quando o resultado é
  // ZERO_RESULTS ou dá erro — só não conta se nem chegou a sair (sem key).
  void registrarUsoApi("geocoding");

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      console.warn(`[geocoding:google] ${response.status} ${response.statusText} — url:`, urlParaLog.toString());
      return null;
    }

    const data = (await response.json()) as {
      status: string;
      error_message?: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number }; location_type?: string };
      }>;
    };

    if (data.status !== "OK") {
      // ZERO_RESULTS é só "não achou" (normal). Qualquer outro status
      // (REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST...) costuma
      // indicar problema de configuração da chave/faturamento — logamos com
      // destaque maior pra facilitar diagnosticar isso depois.
      if (data.status === "ZERO_RESULTS") {
        console.info(`[geocoding:google] ZERO_RESULTS para`, urlParaLog.toString());
      } else {
        console.warn(
          `[geocoding:google] status ${data.status}${data.error_message ? " — " + data.error_message : ""} — url:`,
          urlParaLog.toString()
        );
      }
      return null;
    }

    const primeiro = data.results?.[0];
    const lat = primeiro?.geometry?.location?.lat;
    const lng = primeiro?.geometry?.location?.lng;
    if (lat === undefined || lng === undefined) return null;

    const tipoLocal = primeiro?.geometry?.location_type;
    const precisao: "alta" | "baixa" = tipoLocal === "ROOFTOP" || tipoLocal === "RANGE_INTERPOLATED" ? "alta" : "baixa";

    console.info(`[geocoding:google] encontrado ${lat},${lng} (${tipoLocal ?? "?"}) —`, primeiro?.formatted_address);
    return { latitude: lat, longitude: lng, enderecoEncontrado: primeiro?.formatted_address, precisao };
  } catch (err) {
    console.warn(`[geocoding:google] falha ao consultar`, urlParaLog.toString(), err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
 * Sinal EXTRA (não bloqueante) usado só no passo de texto livre: se o bairro
 * informado não aparece no resultado, só loga um aviso — não descarta o
 * resultado. Isso porque o nome "popular" de um bairro (o que a pessoa
 * digita, geralmente o nome do loteamento/condomínio) frequentemente diverge
 * do nome "oficial" registrado nos Correios/OSM/IBGE. Ex.: o CEP 07791-045
 * fica no loteamento "Portal dos Ipês" (nome que aparece na placa da rua e
 * que a pessoa digita), mas o bairro oficialmente registrado é "Portais"
 * (Polvilho) — exigir que "Portal dos Ipês" apareça no resultado descartaria
 * até a resposta CORRETA. Por isso essa checagem só informa, nunca bloqueia.
 */
function bairroTambemBate(resultado: ResultadoBruto, bairroEsperado?: string | null): boolean {
  if (!bairroEsperado || !bairroEsperado.trim()) return true; // sem bairro informado, não dá pra exigir
  if (!resultado.displayName) return true;
  return normalizar(resultado.displayName).includes(normalizar(bairroEsperado));
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
    return {
      latitude: comCep.latitude,
      longitude: comCep.longitude,
      enderecoEncontrado: comCep.displayName || undefined,
      precisao: "alta",
    };
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
    return {
      latitude: semCep.latitude,
      longitude: semCep.longitude,
      enderecoEncontrado: semCep.displayName || undefined,
      precisao: "alta",
    };
  }
  if (semCep) {
    console.warn(
      `[geocoding] ETAPA 2 descartada: provedor devolveu um lugar de outra cidade ("${semCep.displayName}", esperado "${endereco.cidade}") — tentando próxima etapa.`
    );
  }

  // 3) Google Geocoding API — OPCIONAL (só roda com GOOGLE_MAPS_GEOCODING_
  // API_KEY configurada; sem ela, `buscarGoogle` devolve null na hora e essa
  // etapa é pulada). Entra aqui, logo após as duas buscas estruturadas
  // gratuitas falharem, porque é a fonte mais precisa disponível pro Brasil
  // — o Google tem mapeamento próprio, não depende do OpenStreetMap, e
  // resolve endereços de condomínios/loteamentos fechados que as etapas
  // gratuitas (estruturada, texto livre, BrasilAPI) não conseguem.
  const viaGoogle = await buscarGoogle(endereco, ruaComNumero, estado);
  if (viaGoogle) {
    console.info(`[geocoding] resolvido na ETAPA 3 (Google Geocoding API) — precisão: ${viaGoogle.precisao}`);
    return viaGoogle;
  }

  // 4) Texto livre — o OSM às vezes casa um endereço em busca livre que a
  // busca estruturada (rua+número separados) não encontra, principalmente
  // quando o jeito que a rua está escrita no OSM difere um pouco do
  // esperado. Exige pelo menos bater a cidade. A checagem de bairro
  // (`bairroTambemBate`) só loga um aviso, não bloqueia — ver comentário na
  // função pra entender por quê.
  const textoLivre = [ruaComNumero, endereco.bairro, endereco.cidade, estado, endereco.cep, "Brasil"]
    .filter(Boolean)
    .join(", ");

  const viaTextoLivre = await buscar({ q: textoLivre, countrycodes: "br" });
  if (viaTextoLivre && cidadeBate(viaTextoLivre, endereco.cidade)) {
    if (!bairroTambemBate(viaTextoLivre, endereco.bairro)) {
      console.warn(
        `[geocoding] ETAPA 4: bairro não bate no texto do resultado ("${viaTextoLivre.displayName}", esperado bairro "${endereco.bairro}") — aceitando mesmo assim, cidade confere e o nome popular do bairro costuma divergir do registrado oficialmente.`
      );
    }
    console.warn("[geocoding] resolvido na ETAPA 4 (texto livre) — MENOS CONFIÁVEL pro número exato, mas cidade confere.");
    return {
      latitude: viaTextoLivre.latitude,
      longitude: viaTextoLivre.longitude,
      enderecoEncontrado: viaTextoLivre.displayName || undefined,
      precisao: "baixa",
    };
  }
  if (viaTextoLivre) {
    console.warn(
      `[geocoding] ETAPA 4 descartada: provedor devolveu um lugar de outra cidade ("${viaTextoLivre.displayName}", esperado "${endereco.cidade}") — tentando próxima etapa.`
    );
  }

  // 5) Coordenada pelo CEP via BrasilAPI — ÚLTIMO recurso de todos. Motivo:
  // na prática esse campo se mostrou capaz de devolver um texto de endereço
  // CORRETO ("Avenida Resedá, Portais, Cajamar - SP") junto com uma
  // coordenada que não fica nem perto dessa rua — a BrasilAPI documenta esse
  // campo como "melhor esforço", agregado de fontes que nem sempre são
  // precisas a nível de rua, ao contrário do texto (esse sim vem direto da
  // tabela de CEPs dos Correios, sempre correto). Por isso só usamos como
  // última tentativa, e marcamos `precisao: "baixa"` pra UI insistir bastante
  // na confirmação manual.
  const cepDigitos = endereco.cep.replace(/\D/g, "");
  if (cepDigitos.length === 8) {
    const porCep = await buscarCoordenadaPorCep(cepDigitos);
    if (porCep) {
      console.info(
        "[geocoding] resolvido na ETAPA 5 (coordenada do CEP via BrasilAPI) — só nível de CEP, pode estar em outra rua da região; requer confirmação manual"
      );
      return { ...porCep, precisao: "baixa" };
    }
  }

  return null;
}

/**
 * Busca uma coordenada aproximada só pela cidade/UF — usada exclusivamente
 * para centralizar o mapa de ajuste manual (`PinPicker`) quando
 * `geocodeEndereco` não encontra nada, em vez de deixar a pessoa sem mapa
 * nenhum pra posicionar o pino. NUNCA deve ser salva como se fosse a
 * localização real do endereço — é só um ponto de partida pro usuário
 * arrastar o pino até o lugar certo.
 */
export async function geocodeCidadeAproximado(cidade: string, estado: string): Promise<GeocodeResult | null> {
  if (!cidade.trim()) return null;
  const resultado = await buscar({ city: cidade, state: nomeEstado(estado), country: "Brazil" });
  return resultado ? { latitude: resultado.latitude, longitude: resultado.longitude } : null;
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
