import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { fecharPercurso } from "@/lib/percurso";

// Quantos dias manter o rastro detalhado de GPS (lat/lon ponto a ponto) —
// depois disso, apaga só os pontos; os agregados do dia (distância, quantos
// embarcaram/ficaram ausentes) continuam pra sempre em PercursoDia, que é
// uma tabela pequena e é o que realmente importa pro relatório histórico.
// Minimização de dados (LGPD): não há razão pra guardar a trilha exata de
// GPS de um motorista por tempo indefinido.
const GPS_RETENCAO_DIAS = Number(process.env.GPS_RETENCAO_DIAS) || 90;

// Uma rota nunca deveria legitimamente ficar "aberta" por mais que isso —
// se passou, é sinal de que o motorista fechou o app sem clicar em
// "Encerrar rota" (ou só clicou em "Parar"). Fecha sozinho pra não deixar
// pontos de dias seguintes grudando no mesmo percurso por engano.
const PERCURSO_ABERTO_MAX_HORAS = 20;

function autenticado(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Limpeza diária (ver vercel.json — agendado via Vercel Cron, que injeta o
 * header Authorization automaticamente a partir da env var CRON_SECRET).
 * Também pode ser chamado manualmente com `curl -H "Authorization: Bearer
 * $CRON_SECRET" https://.../api/cron/limpeza` se precisar rodar na mão.
 */
export async function GET(request: NextRequest) {
  if (!autenticado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const agora = new Date();

  // 1) Fecha sozinho percursos abertos há tempo demais, antes de podar
  // pontos — senão os pontos deles nunca seriam considerados "de um
  // percurso fechado" e ficariam pra sempre fora da limpeza.
  const limiteAbandono = new Date(agora.getTime() - PERCURSO_ABERTO_MAX_HORAS * 60 * 60 * 1000);
  const abandonados = await prisma.percursoDia.findMany({
    where: { encerradoEm: null, iniciadoEm: { lt: limiteAbandono } },
    select: { id: true, iniciadoEm: true },
  });
  for (const p of abandonados) {
    // Fecha com o horário do início (não temos um "último ponto visto" à
    // mão aqui sem outra query; é só um metadado de fallback, o cálculo de
    // distância usa os pontos reais, não esse timestamp).
    await fecharPercurso(p.id, p.iniciadoEm);
  }

  // 2) Poda os pontos de GPS de percursos já encerrados há mais que a
  // janela de retenção.
  const limiteRetencao = new Date(agora.getTime() - GPS_RETENCAO_DIAS * 24 * 60 * 60 * 1000);
  const pontosApagados = await prisma.percursoPonto.deleteMany({
    where: { percurso: { encerradoEm: { lt: limiteRetencao } } },
  });

  // 3) Housekeeping das tabelas de apoio — nenhuma delas tem valor depois
  // de um tempo curto (tentativas de rate limit só importam por 15 min;
  // códigos de verificação expiram em 10 min).
  const tentativasApagadas = await prisma.tentativaAcesso.deleteMany({
    where: { criadoEm: { lt: new Date(agora.getTime() - 24 * 60 * 60 * 1000) } },
  });
  const codigosApagados = await prisma.codigoVerificacao.deleteMany({
    where: { criadoEm: { lt: new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000) } },
  });
  // Uso das APIs do Google (ver /admin/uso-google) só conta o mês corrente —
  // 40 dias de folga garante que nunca apaga nada que ainda esteja dentro do
  // mês em contagem, mesmo perto da virada.
  const usoApiApagado = await prisma.usoApiExterna.deleteMany({
    where: { criadoEm: { lt: new Date(agora.getTime() - 40 * 24 * 60 * 60 * 1000) } },
  });

  return NextResponse.json({
    ok: true,
    percursosAbandonadosFechados: abandonados.length,
    pontosGpsApagados: pontosApagados.count,
    tentativasLoginApagadas: tentativasApagadas.count,
    codigosVerificacaoApagados: codigosApagados.count,
    usoApiExternaApagado: usoApiApagado.count,
  });
}
