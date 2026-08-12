import "server-only";

import { prisma } from "@/lib/prisma";

// Contador de uso das 3 integrações pagas com o Google (todas OPCIONAIS —
// ver src/lib/geocoding.ts, src/lib/routing/google-directions.ts e
// src/components/ui/GoogleEnderecoAutocomplete.tsx), pra dar visibilidade
// no painel admin de quanto do limite gratuito mensal já foi consumido
// antes de começar a gerar fatura. Cada API tem sua própria cota mensal
// (não são somadas entre si) — ver comentário de cada uma abaixo.
//
// Os números de limite são os publicados pelo Google em
// https://mapsplatform.google.com/pricing/ (checado em 2026-08) — como o
// Google pode ajustar isso, trate como referência aproximada, não garantia
// exata de "zero cobrança até aqui".

export type ApiExterna = "geocoding" | "places_autocomplete" | "routes_directions";

export const LABEL_API: Record<ApiExterna, string> = {
  geocoding: "Geocoding API",
  places_autocomplete: "Places Autocomplete",
  routes_directions: "Routes API (Directions)",
};

export const DESCRICAO_API: Record<ApiExterna, string> = {
  geocoding: "Fallback pago quando LocationIQ/Nominatim/BrasilAPI não encontram o endereço (cadastro de responsável/escola).",
  places_autocomplete: "Busca de endereço por texto livre nos formulários (uma sessão = uma busca até a seleção).",
  routes_directions: "Fallback pago quando o OSRM falha ao calcular a rota do motorista (nunca no polling do responsável).",
};

// 10.000/mês grátis nas 3 — depois disso o Google cobra por uso adicional
// (não trava o app, só passa a gerar fatura).
export const LIMITE_GRATIS_MENSAL: Record<ApiExterna, number> = {
  geocoding: 10_000,
  places_autocomplete: 10_000,
  routes_directions: 10_000,
};

/** Env var que precisa estar configurada pra essa API rodar de fato — usado
 * só pra distinguir "0 usos porque não está configurada" de "0 usos porque
 * ainda não precisou". */
function apiConfigurada(api: ApiExterna): boolean {
  switch (api) {
    case "geocoding":
      return Boolean(process.env.GOOGLE_MAPS_GEOCODING_API_KEY);
    case "routes_directions":
      return Boolean(process.env.GOOGLE_MAPS_DIRECTIONS_API_KEY || process.env.GOOGLE_MAPS_GEOCODING_API_KEY);
    case "places_autocomplete":
      return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);
  }
}

/**
 * Registra uma chamada real feita a uma das APIs pagas do Google. Chamado
 * de "melhor esforço" — nunca deve derrubar o fluxo principal (geocodificar
 * um endereço, calcular uma rota) por causa de uma falha ao gravar essa
 * telemetria, por isso engole qualquer erro.
 */
export async function registrarUsoApi(api: ApiExterna): Promise<void> {
  try {
    await prisma.usoApiExterna.create({ data: { api } });
  } catch (err) {
    console.warn(`[uso-api-externa] falha ao registrar uso de "${api}"`, err);
  }
}

function inicioDoMesAtual(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

async function contarUsoApiNoMes(api: ApiExterna): Promise<number> {
  return prisma.usoApiExterna.count({ where: { api, criadoEm: { gte: inicioDoMesAtual() } } });
}

export type ResumoApi = {
  api: ApiExterna;
  label: string;
  descricao: string;
  configurada: boolean;
  contagem: number;
  limite: number;
  percentual: number; // 0-100+ (pode passar de 100 se estourou o grátis)
};

/** Resumo pronto pra UI: uso do mês corrente de cada uma das 3 APIs,
 * comparado ao limite gratuito mensal. Usado tanto na página de detalhe
 * (`/admin/uso-google`) quanto no banner de aviso do AdminShell. */
export async function resumoUsoApis(): Promise<ResumoApi[]> {
  const apis: ApiExterna[] = ["geocoding", "places_autocomplete", "routes_directions"];

  const contagens = await Promise.all(apis.map((api) => contarUsoApiNoMes(api)));

  return apis.map((api, i) => {
    const limite = LIMITE_GRATIS_MENSAL[api];
    const contagem = contagens[i];
    return {
      api,
      label: LABEL_API[api],
      descricao: DESCRICAO_API[api],
      configurada: apiConfigurada(api),
      contagem,
      limite,
      percentual: Math.round((contagem / limite) * 100),
    };
  });
}
