import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";

const coordenadasSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Salva a coordenada que o responsável confirmou/ajustou manualmente no
 * mapa (ver PinPicker) — não passa pelo geocodificador de novo, é a pessoa
 * dizendo diretamente "o ponto certo é este aqui". Usado quando a
 * geocodificação automática (LocationIQ/Nominatim) acerta a rua mas erra a
 * casa, ou cai num ponto vizinho.
 */
export async function PATCH(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = coordenadasSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { latitude, longitude } = parsed.data;

  await prisma.responsavel.update({
    where: { id: responsavel.id },
    data: {
      enderecoLatitude: latitude,
      enderecoLongitude: longitude,
      // Pino ajustado à mão pela própria pessoa — essa é a fonte de
      // confiança mais alta que existe, marca como confirmado. O texto do
      // provedor não se aplica mais (o ponto real não é mais o que ele
      // "achou"), então limpa pra não mostrar informação desatualizada.
      enderecoTextoEncontrado: null,
      enderecoConfirmado: true,
      enderecoPrecisaoBaixa: false,
      enderecoAtualizadoEm: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
