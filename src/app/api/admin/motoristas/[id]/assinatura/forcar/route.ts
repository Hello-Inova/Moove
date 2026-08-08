import { NextRequest, NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { forcarAssinaturaSchema } from "@/lib/validation/schemas";
import { forcarAssinaturaAtiva } from "@/lib/subscription/service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = forcarAssinaturaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const motorista = await prisma.motorista.findUnique({ where: { id } });
  if (!motorista) return jsonError(404, "Motorista não encontrado.");

  await forcarAssinaturaAtiva(id, parsed.data.tipoPlano);

  return NextResponse.json({ ok: true });
}
