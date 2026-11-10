import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonValidationError } from "@/lib/http";
import { atualizarStatusChamadoSchema } from "@/lib/validation/schemas";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");
  const parsed = atualizarStatusChamadoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonValidationError(parsed.error);
  const { id } = await params;
  const chamado = await prisma.chamadoSuporte.update({ where: { id }, data: { status: parsed.data.status } }).catch(() => null);
  if (!chamado) return jsonError(404, "Chamado não encontrado.");
  return NextResponse.json({ chamado });
}
