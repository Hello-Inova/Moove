import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonRateLimited } from "@/lib/http";
import { checarRateLimit, clientIp, registrarTentativa } from "@/lib/rate-limit";
import { haversineMetros, estimarEtaMinutos } from "@/lib/geo/distancia";
import { notificarPush } from "@/lib/push/notificar";

/** Notifica o responsável quando o motorista escolhe este aluno como próximo destino.
 * O limite por vínculo evita que cliques repetidos virem spam. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const limite = await checarRateLimit(`a-caminho:vinculo:${id}`, { max: 1, janelaMinutos: 5 });
  if (!limite.ok) return jsonRateLimited(limite.retryAfterSegundos);
  const limiteIp = await checarRateLimit(`a-caminho:ip:${clientIp(request)}`, { max: 12, janelaMinutos: 15 });
  if (!limiteIp.ok) return jsonRateLimited(limiteIp.retryAfterSegundos);

  const vinculo = await prisma.vinculo.findFirst({
    where: { id, motoristaId: motorista.id, status: "ATIVO" },
    select: {
      responsavelId: true,
      aluno: { select: { nome: true, enderecoLatitude: true, enderecoLongitude: true } },
    },
  });
  if (!vinculo) return jsonError(404, "Vínculo não encontrado.");
  if (vinculo.aluno.enderecoLatitude === null || vinculo.aluno.enderecoLongitude === null) {
    return jsonError(409, "Este aluno ainda não tem endereço localizado no mapa.");
  }

  const localizacao = await prisma.localizacao.findUnique({ where: { motoristaId: motorista.id } });
  if (!localizacao) return jsonError(409, "Ative o compartilhamento de localização antes de avisar o responsável.");

  await Promise.all([
    registrarTentativa(`a-caminho:vinculo:${id}`),
    registrarTentativa(`a-caminho:ip:${clientIp(request)}`),
  ]);
  const etaMinutos = Math.max(
    1,
    Math.round(
      estimarEtaMinutos(
        haversineMetros(localizacao, {
          latitude: vinculo.aluno.enderecoLatitude,
          longitude: vinculo.aluno.enderecoLongitude,
        })
      )
    )
  );
  await notificarPush(
    { responsavelId: vinculo.responsavelId },
    {
      title: "O motorista está a caminho",
      body: `O transporte está indo buscar ${vinculo.aluno.nome}. Chegada estimada: ${etaMinutos} min.`,
      tag: `a-caminho-${id}`,
    }
  );
  return NextResponse.json({ etaMinutos });
}
