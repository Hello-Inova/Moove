import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { validarConviteSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import { vagasDisponiveisParaVincular } from "@/lib/subscription/service";

/**
 * Passo 1 do fluxo "usar convite": só confere se o código é válido e
 * devolve o necessário pro responsável escolher qual aluno e qual escola
 * (dentre as do motorista) — a criação do vínculo em si acontece em
 * POST /api/responsavel/convites/usar (passo 2), depois dessa escolha.
 */
export async function POST(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = validarConviteSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { codigo } = parsed.data;

  const convite = await prisma.convite.findUnique({
    where: { codigo },
    include: { motorista: { select: { nome: true, escolas: { select: { id: true, nome: true } } } } },
  });
  if (!convite) return jsonError(404, "Código de convite inválido.");

  if (convite.status === "PENDENTE" && convite.expiraEm.getTime() < Date.now()) {
    return jsonError(410, "Este código de convite expirou.");
  }
  if (convite.status !== "PENDENTE") {
    const motivo =
      convite.status === "USADO"
        ? "Este código já foi utilizado."
        : convite.status === "REVOGADO"
          ? "Este código foi revogado pelo motorista."
          : "Este código expirou.";
    return jsonError(409, motivo);
  }

  const vagasDisponiveis = await vagasDisponiveisParaVincular(responsavel.id);

  const alunosDisponiveis = await prisma.aluno.findMany({
    where: { responsavelId: responsavel.id, vinculos: { none: { status: "ATIVO" } } },
    select: { id: true, nome: true },
    orderBy: { criadoEm: "asc" },
  });

  return NextResponse.json({
    motoristaNome: convite.motorista.nome,
    escolas: convite.motorista.escolas,
    alunosDisponiveis,
    vagasDisponiveis,
  });
}
