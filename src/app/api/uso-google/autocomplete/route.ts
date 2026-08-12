import { NextRequest, NextResponse } from "next/server";

import { checarRateLimit, registrarTentativa, clientIp } from "@/lib/rate-limit";
import { registrarUsoApi } from "@/lib/uso-api-externa";

// Telemetria de uso do Google Places Autocomplete (ver
// src/components/ui/GoogleEnderecoAutocomplete.tsx) — como o Autocomplete
// roda inteiramente no navegador (chama o Google direto, sem passar pelo
// nosso servidor), essa é a única forma de o painel admin saber quantas
// "sessões" foram usadas no mês. Chamado uma vez por sessionToken novo
// (ou seja, por busca — não por tecla digitada), o que aproxima bem a
// unidade que o Google realmente cobra.
//
// Endpoint público (sem autenticação — é chamado por qualquer visitante
// preenchendo um formulário de endereço), mas com rate limit generoso por
// IP pra não virar vetor de poluir o contador. Nunca falha de verdade pro
// cliente: é telemetria, não deve travar o autocomplete de ninguém.
export async function POST(request: NextRequest) {
  const chave = `uso-google-autocomplete:ip:${clientIp(request)}`;
  const limite = await checarRateLimit(chave, { max: 60, janelaMinutos: 5 });

  if (limite.ok) {
    await registrarTentativa(chave);
    await registrarUsoApi("places_autocomplete");
  }

  return new NextResponse(null, { status: 204 });
}
