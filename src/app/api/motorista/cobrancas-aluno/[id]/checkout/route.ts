import { NextResponse } from "next/server";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import {
  criarCheckoutCobrancaAluno,
  CobrancaAlunoNaoEncontradaError,
  CobrancaAlunoJaFinalizadaError,
} from "@/lib/subscription/cobranca-aluno-pagamento";
import { AsaasNotConfiguredError, AsaasApiError, AsaasPayerSemCpfError } from "@/lib/payment/asaas";

/**
 * Gera (ou reaproveita) o link de pagamento Asaas de uma cobrança por aluno
 * pendente — o motorista clica em "Pagar" na tela /motorista/vinculos e é
 * redirecionado pra essa URL. Mesmo padrão de erros da rota de checkout de
 * assinatura (ver /api/motorista/assinatura/checkout).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  try {
    const { checkoutUrl } = await criarCheckoutCobrancaAluno({
      cobrancaAlunoId: id,
      motoristaId: motorista.id,
    });

    return NextResponse.json({ checkoutUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof CobrancaAlunoNaoEncontradaError) {
      return jsonError(404, err.message);
    }
    if (err instanceof CobrancaAlunoJaFinalizadaError) {
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
