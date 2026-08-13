import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError, jsonValidationError } from "@/lib/http";
import { criarCheckoutAssinaturaSchema } from "@/lib/validation/schemas";
import { criarAssinaturaComCheckout, PlanoInexistenteError } from "@/lib/subscription/service";
import { buscarPlanoPorCodigo } from "@/lib/subscription/planos-service";
import { AsaasNotConfiguredError, AsaasApiError, AsaasPayerSemCpfError } from "@/lib/payment/asaas";

export async function POST(request: NextRequest) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = criarCheckoutAssinaturaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { tipoPlano, anosAdicionais } = parsed.data;

  const plano = await buscarPlanoPorCodigo(tipoPlano);
  if (!plano || !plano.ativo || plano.publico !== "MOTORISTA") {
    return jsonError(404, "Plano não encontrado ou não está mais disponível.");
  }

  if (anosAdicionais && anosAdicionais > 0 && !plano.permiteAnosAdicionais) {
    return jsonError(400, `Anos adicionais não estão disponíveis no plano ${plano.label}.`);
  }

  try {
    const { checkoutUrl } = await criarAssinaturaComCheckout({
      motoristaId: motorista.id,
      motoristaNome: motorista.nome,
      motoristaEmail: motorista.email,
      motoristaCpf: motorista.cpf,
      tipoPlano,
      anosAdicionais,
    });

    return NextResponse.json({ checkoutUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof AsaasNotConfiguredError) {
      return jsonError(503, err.message);
    }
    if (err instanceof AsaasPayerSemCpfError) {
      return jsonError(400, "Complete seu CPF no cadastro antes de assinar um plano.");
    }
    if (err instanceof AsaasApiError) {
      return jsonError(502, "Não foi possível criar o pagamento na Asaas agora. Tente novamente em instantes.");
    }
    if (err instanceof PlanoInexistenteError) {
      return jsonError(404, err.message);
    }
    throw err;
  }
}
