import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { atualizarLocalizacaoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { isLocationStale } from "@/lib/location";
import { haversineMetros, estimarEtaMinutos } from "@/lib/geo/distancia";
import { notificarPush } from "@/lib/push/notificar";

/** Se houver um percurso aberto (ver /api/motorista/percurso/iniciar),
 * registra este ponto de GPS nele — é o que alimenta a distância percorrida
 * mostrada no relatório diário. Silencioso se não houver percurso aberto
 * (compatibilidade: motorista pode ter uma sessão antiga sem ter clicado em
 * "Iniciar rota" através do fluxo novo). */
async function registrarPontoPercurso(
  motoristaId: string,
  posicao: { latitude: number; longitude: number }
) {
  const aberto = await prisma.percursoDia.findFirst({
    where: { motoristaId, encerradoEm: null },
    orderBy: { iniciadoEm: "desc" },
    select: { id: true },
  });
  if (!aberto) return;

  await prisma.percursoPonto.create({
    data: { percursoId: aberto.id, latitude: posicao.latitude, longitude: posicao.longitude },
  });
}

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

    await notificarPush(
      { responsavelId: vinculo.responsavelId },
      {
        title: "O transporte está chegando",
        body: `Faltam cerca de ${motorista.alertaChegadaMinutos} min para o motorista chegar — ${vinculo.aluno.nome}.`,
        tag: `chegada-${vinculo.id}`,
      }
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

  // Nem o alerta de proximidade nem o registro do trajeto podem derrubar a
  // atualização de GPS em si, que é o que mais importa.
  try {
    await registrarPontoPercurso(motorista.id, { latitude, longitude });
  } catch (err) {
    console.error("[percurso] erro ao registrar ponto", err);
  }

  try {
    await verificarAlertasProximidade(motorista.id, { latitude, longitude });
  } catch (err) {
    console.error("[alerta-proximidade] erro ao verificar", err);
  }

  return NextResponse.json({ ok: true });
}
