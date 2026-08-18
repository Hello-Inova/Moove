import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";

/** Data de hoje truncada (sem hora), em UTC — chave do dia na tabela
 * embarques_dia. Não precisa ser exata ao fuso do motorista: o que importa
 * é ser estável durante o dia inteiro da rota. */
function hojeData(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

function sentidoDaQuery(valor: string | null): "IDA" | "VOLTA" {
  return valor === "volta" ? "VOLTA" : "IDA";
}

/**
 * Status de hoje (Embarcou/Ausente) de todos os vínculos ativos do
 * motorista — usado pelo RotaPanel pra restaurar a marcação ao carregar a
 * página (antes só vivia em memória e sumia ao atualizar).
 *
 * `?sentido=volta` filtra pela marcação da rota de volta (buscar na
 * escola) — sem o parâmetro, é a da ida (buscar em casa), que é o padrão
 * de sempre. Ida e volta têm marcações independentes: o aluno pode ter
 * embarcado de manhã e ainda não ter sido marcado na volta.
 */
export async function GET(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const sentido = sentidoDaQuery(request.nextUrl.searchParams.get("sentido"));

  const registros = await prisma.embarqueDia.findMany({
    where: { data: hojeData(), sentido, vinculo: { motoristaId: motorista.id } },
    select: { vinculoId: true, status: true },
  });

  return NextResponse.json(registros);
}

const patchSchema = z.object({
  vinculoId: z.string().min(1),
  status: z.enum(["EMBARCOU", "AUSENTE"]).nullable(),
  sentido: z.enum(["IDA", "VOLTA"]).default("IDA"),
});

/**
 * Marca (ou desmarca, com status: null) o status de hoje de um vínculo —
 * usado pelos botões "Embarcou" / "Ausente" / "Desfazer" no painel de rota.
 * `sentido` diferencia a marcação da ida da marcação da volta (ver GET
 * acima) — cada uma tem sua própria linha em embarques_dia.
 */
export async function PATCH(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { vinculoId, status, sentido } = parsed.data;

  const vinculo = await prisma.vinculo.findUnique({ where: { id: vinculoId } });
  if (!vinculo || vinculo.motoristaId !== motorista.id) {
    return jsonError(404, "Vínculo não encontrado.");
  }

  const data = hojeData();

  if (status === null) {
    await prisma.embarqueDia.deleteMany({ where: { vinculoId, data, sentido } });
    return NextResponse.json({ ok: true, status: null });
  }

  await prisma.embarqueDia.upsert({
    where: { vinculoId_data_sentido: { vinculoId, data, sentido } },
    update: { status },
    create: { vinculoId, data, sentido, status },
  });

  return NextResponse.json({ ok: true, status });
}
