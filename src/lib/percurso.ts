import "server-only";

import { prisma } from "@/lib/prisma";
import { haversineMetros } from "@/lib/geo/distancia";

/** Data de hoje truncada (sem hora), em UTC — mesma convenção usada em
 * embarques_dia e alertas_proximidade. */
export function hojeData(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

function mesmaData(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/**
 * Fecha um percurso: soma a distância percorrida (a partir dos pontos de
 * GPS coletados) e tira um snapshot dos status de embarque (Embarcou/
 * Ausente) do dia — usado tanto pelo botão "Encerrar rota" quanto pelo
 * fechamento automático de um percurso esquecido aberto (ver
 * `abrirOuReutilizarPercurso`).
 */
export async function fecharPercurso(percursoId: string, encerradoEm: Date = new Date()) {
  const percurso = await prisma.percursoDia.findUnique({ where: { id: percursoId } });
  if (!percurso || percurso.encerradoEm) return percurso;

  const pontos = await prisma.percursoPonto.findMany({
    where: { percursoId },
    orderBy: { criadoEm: "asc" },
    select: { latitude: true, longitude: true },
  });

  let distanciaMetros = 0;
  for (let i = 1; i < pontos.length; i++) {
    distanciaMetros += haversineMetros(pontos[i - 1], pontos[i]);
  }

  const [totalAlunos, totalEmbarcaram, totalAusentes] = await Promise.all([
    prisma.vinculo.count({ where: { motoristaId: percurso.motoristaId, status: "ATIVO" } }),
    prisma.embarqueDia.count({
      where: { data: percurso.data, status: "EMBARCOU", vinculo: { motoristaId: percurso.motoristaId } },
    }),
    prisma.embarqueDia.count({
      where: { data: percurso.data, status: "AUSENTE", vinculo: { motoristaId: percurso.motoristaId } },
    }),
  ]);

  return prisma.percursoDia.update({
    where: { id: percursoId },
    data: {
      encerradoEm,
      distanciaMetros: pontos.length > 1 ? distanciaMetros : null,
      totalAlunos,
      totalEmbarcaram,
      totalAusentes,
    },
  });
}

/**
 * Reaproveita um percurso já aberto hoje (ex: motorista atualizou a página
 * e clicou em "Iniciar rota" de novo) ou cria um novo. Se existir um
 * percurso aberto de um DIA ANTERIOR (motorista esqueceu de clicar em
 * "Encerrar rota" e só apertou "Parar" ou fechou o app), fecha ele sozinho
 * antes — sem isso, os pontos de hoje entrariam por engano no percurso de
 * ontem.
 */
export async function abrirOuReutilizarPercurso(motoristaId: string): Promise<string> {
  const hoje = hojeData();

  const aberto = await prisma.percursoDia.findFirst({
    where: { motoristaId, encerradoEm: null },
    orderBy: { iniciadoEm: "desc" },
  });

  if (aberto) {
    if (mesmaData(aberto.data, hoje)) return aberto.id;
    // Percurso de um dia anterior, abandonado sem "Encerrar rota" — fecha
    // com os dados que já tem antes de abrir um novo pra hoje.
    await fecharPercurso(aberto.id, aberto.iniciadoEm);
  }

  const novo = await prisma.percursoDia.create({
    data: { motoristaId, data: hoje, iniciadoEm: new Date() },
  });
  return novo.id;
}
