import { NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import {
  criarCheckoutCobrancasAlunoPendentes,
  SemCobrancaPendenteError,
  ValorAbaixoDoMinimoError,
} from "@/lib/subscription/cobranca-aluno-pagamento";
import { AsaasNotConfiguredError, AsaasApiError, AsaasPayerSemCpfError } from "@/lib/payment/asaas";

/**
 * Gera o link de pagamento Asaas cobrindo TODAS as cobranças por aluno
 * pendentes do motorista autenticado de uma vez (nunca uma por uma — ver
 * criarCheckoutCobrancasAlunoPendentes pro motivo). O motorista clica em
 * "Pagar tudo" na tela /motorista/vinculos e é redirecionado pra essa URL.
 */
export async function POST() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  try {
    const { checkoutUrl } = await criarCheckoutCobrancasAlunoPendentes(motorista.id);

    return NextResponse.json({ checkoutUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof SemCobrancaPendenteError) {
      return jsonError(404, err.message);
    }
    if (err instanceof ValorAbaixoDoMinimoError) {
      return jsonError(409, err.message);
    }
    if (err instanceof AsaasNotConfiguredError) {
      return jsonError(503, err.message);
    }
    if (err instanceof AsaasPayerSemCpfError) {
      return jsonError(400, "Complete seu CPF no seu perfil (clique no seu nome no topo da tela) antes de pagar essa cobrança.");
    }
    if (err instanceof AsaasApiError) {
      return jsonError(502, "Não foi possível criar o pagamento na Asaas agora. Tente novamente em instantes.");
    }
    throw err;
  }
}
