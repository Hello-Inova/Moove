import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedResponsavel } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { criarCheckoutAssinaturaResponsavelSchema } from "@/lib/validation/schemas";
import { criarAssinaturaResponsavelComCheckout, PlanoInexistenteError } from "@/lib/subscription/service";
import { MercadoPagoNotConfiguredError, MercadoPagoApiError } from "@/lib/payment/mercadopago";

export async function POST(request: NextRequest) {
  const responsavel = await getAuthenticatedResponsavel();
  if (!responsavel) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = criarCheckoutAssinaturaResponsavelSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  // A quantidade cobrada é sempre a quantidade ATUAL de alunos cadastrados
  // pelo responsável — recalculada no servidor, nunca confiamos num número
  // vindo do cliente (o mesmo princípio usado no cálculo de preço).
  const qtdAlunos = await prisma.aluno.count({ where: { responsavelId: responsavel.id } });
  if (qtdAlunos === 0) {
    return jsonError(400, "Cadastre pelo menos um aluno antes de assinar um plano.");
  }

  try {
    const { checkoutUrl } = await criarAssinaturaResponsavelComCheckout({
      responsavelId: responsavel.id,
      responsavelNome: responsavel.nome,
      responsavelEmail: responsavel.email,
      tipoPlano: parsed.data.tipoPlano,
      qtdAlunos,
    });

    return NextResponse.json({ checkoutUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof MercadoPagoNotConfiguredError) return jsonError(503, err.message);
    if (err instanceof MercadoPagoApiError) {
      return jsonError(502, "Não foi possível criar o pagamento no Mercado Pago agora. Tente novamente em instantes.");
    }
    if (err instanceof PlanoInexistenteError) return jsonError(404, err.message);
    throw err;
  }
}
