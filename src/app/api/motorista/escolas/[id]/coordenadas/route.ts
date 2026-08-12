import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";

const coordenadasSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Salva a coordenada que o motorista confirmou/ajustou manualmente no mapa
 * (ver PinPicker em EscolaForm.tsx) — não passa pelo geocodificador de novo,
 * é a pessoa dizendo diretamente "o ponto certo é este aqui". Espelha
 * `POST /api/responsavel/endereco/coordenadas`; usado quando a
 * geocodificação automática (LocationIQ/Nominatim/BrasilAPI) erra o ponto —
 * comum em loteamentos e condomínios fechados mal mapeados.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const escola = await prisma.escola.findUnique({ where: { id } });
  if (!escola || escola.motoristaId !== motorista.id) {
    return jsonError(404, "Escola não encontrada.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = coordenadasSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { latitude, longitude } = parsed.data;

  await prisma.escola.update({
    where: { id },
    data: {
      enderecoLatitude: latitude,
      enderecoLongitude: longitude,
      // Pino ajustado à mão pelo motorista — fonte de confiança mais alta
      // que existe, marca como confirmado. O texto do provedor não se
      // aplica mais, então limpa pra não mostrar informação desatualizada.
      enderecoTextoEncontrado: null,
      enderecoConfirmado: true,
    },
  });

  return NextResponse.json({ ok: true });
}
