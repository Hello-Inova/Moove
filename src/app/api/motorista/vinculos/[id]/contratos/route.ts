import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { criarContratoTransporteSchema } from "@/lib/validation/schemas";

/** Registra um contrato de transporte pra esse vínculo — texto livre + link
 * opcional (não há upload de arquivo no sistema; se o motorista já tem um
 * PDF assinado hospedado em outro lugar, cola o link). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;
  const vinculo = await prisma.vinculo.findUnique({ where: { id } });
  if (!vinculo || vinculo.motoristaId !== motorista.id) {
    return jsonError(404, "Vínculo não encontrado.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = criarContratoTransporteSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const contrato = await prisma.contratoTransporte.create({
    data: {
      vinculoId: id,
      titulo: parsed.data.titulo,
      observacoes: parsed.data.observacoes || null,
      arquivoUrl: parsed.data.arquivoUrl || null,
      vigenciaInicio: parsed.data.vigenciaInicio,
      vigenciaFim: parsed.data.vigenciaFim,
    },
  });

  return NextResponse.json({ ok: true, contrato }, { status: 201 });
}
