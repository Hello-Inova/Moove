import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { criarCheckoutAssinaturaSchema } from "@/lib/validation/schemas";
import { criarAssinaturaComCheckout } from "@/lib/subscription/service";
import { MercadoPagoNotConfiguredError } from "@/lib/payment/mercadopago";
import { PLANOS } from "@/lib/subscription/plans";

export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = criarCheckoutAssinaturaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { tipoPlano, qtdAlunos, anosAdicionais } = parsed.data;

  if (anosAdicionais && anosAdicionais > 0 && !PLANOS[tipoPlano].permiteAnosAdicionais) {
    return jsonError(400, "Anos adicionais só estão disponíveis no plano Max.");
  }

  try {
    const { checkoutUrl } = await criarAssinaturaComCheckout({
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
      motoristaEmail: motorista.email,
      tipoPlano,
      qtdAlunos,
      anosAdicionais,
    });

    return NextResponse.json({ checkoutUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof MercadoPagoNotConfiguredError) {
      return jsonError(503, err.message);
    }
    throw err;
  }
}
