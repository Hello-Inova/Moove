import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { atualizarLocalizacaoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { isLocationStale } from "@/lib/location";
import { haversineMetros, estimarEtaMinutos } from "@/lib/geo/distancia";
import { enviarNotificacaoPush, PushNaoConfiguradoError, PushSubscriptionInvalidaError } from "@/lib/push/webpush";

/** Data de hoje truncada (sem hora), em UTC — mesma convenção usada em
 * embarques_dia (ver src/app/api/motorista/embarques/route.ts). */
function hojeData(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

/**
 * Verifica, pra cada vínculo ativo do motorista, se a distância estimada
 * até o endereço do responsável já entrou no raio configurado
 * (alertaChegadaMinutos) — se sim e ainda não avisou hoje, dispara o Web
 * Push com o alerta sonoro. Roda a cada atualização de GPS (12 em 12s);
 * por isso usa distância em linha reta (ver distancia.ts) em vez de
 * recalcular rota no OSRM a cada chamada.
 */
async function verificarAlertasProximidade(
  motoristaId: string,
  posicaoMotorista: { latitude: number; longitude: number }
) {
  const motorista = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: { alertaChegadaMinutos: true },
  });
  if (!motorista) return;

  const vinculos = await prisma.vinculo.findMany({
    where: { motoristaId, status: "ATIVO" },
    select: {
      id: true,
      responsavelId: true,
      aluno: { select: { nome: true } },
      responsavel: { select: { enderecoLatitude: true, enderecoLongitude: true } },
    },
  });

  const hoje = hojeData();

  for (const vinculo of vinculos) {
    const { enderecoLatitude, enderecoLongitude } = vinculo.responsavel;
    if (enderecoLatitude === null || enderecoLongitude === null) continue;

    const distanciaMetros = haversineMetros(posicaoMotorista, {
      latitude: enderecoLatitude,
      longitude: enderecoLongitude,
    });
    const etaMinutos = estimarEtaMinutos(distanciaMetros);

    if (etaMinutos > motorista.alertaChegadaMinutos) continue;

    // Idempotência: só um alerta por vínculo por dia — a checagem roda a
    // cada 12s, e o motorista pode ficar minutos dentro do raio.
    try {
      await prisma.alertaProximidade.create({ data: { vinculoId: vinculo.id, data: hoje } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { responsavelId: vinculo.responsavelId },
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await enviarNotificacaoPush(sub, {
            title: "O transporte está chegando",
            body: `Faltam cerca de ${motorista.alertaChegadaMinutos} min para o motorista chegar — ${vinculo.aluno.nome}.`,
            tag: `chegada-${vinculo.id}`,
          });
        } catch (err) {
          if (err instanceof PushSubscriptionInvalidaError) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            return;
          }
          if (err instanceof PushNaoConfiguradoError) {
            console.warn("[alerta-proximidade]", err.message);
            return;
          }
          console.error("[alerta-proximidade] falha ao enviar push", err);
        }
      })
    );
  }
}

export async function GET() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const localizacao = await prisma.localizacao.findUnique({ where: { motoristaId: motorista.id } });
  if (!localizacao) return NextResponse.json({ localizacao: null });

  return NextResponse.json({
    localizacao: {
      latitude: localizacao.latitude,
      longitude: localizacao.longitude,
      atualizadoEm: localizacao.atualizadoEm,
      desatualizada: isLocationStale(localizacao.atualizadoEm),
    },
  });
}

export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = atualizarLocalizacaoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { latitude, longitude } = parsed.data;

  await prisma.localizacao.upsert({
    where: { motoristaId: motorista.id },
    create: { motoristaId: motorista.id, latitude, longitude },
    update: { latitude, longitude },
  });

  // Não deixa uma falha no envio do alerta derrubar a atualização de GPS —
  // o rastreamento em si é o que importa mais; o alerta é um "bônus".
  try {
    await verificarAlertasProximidade(motorista.id, { latitude, longitude });
  } catch (err) {
    console.error("[alerta-proximidade] erro ao verificar", err);
  }

  return NextResponse.json({ ok: true });
}
