import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { confirmarPagamentoAsaas, getAssinaturaAtual } from "@/lib/subscription/service";

/**
 * Rede de segurança contra falha do webhook da Asaas (evento não configurado,
 * token errado, instabilidade momentânea, etc.): revalida direto na API da
 * Asaas qualquer pagamento PENDENTE do motorista logado, em vez de confiar
 * cegamente que o webhook vai chegar. Chamada automaticamente pela tela de
 * planos (ver PlanosClient.tsx) sempre que ela carrega — barata quando não
 * há nada pendente (só uma query), e idempotente quando há (mesma lógica de
 * `confirmarPagamentoAsaas` usada pelo webhook).
 */
export async function POST() {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) return jsonError(401, "Não autenticado.");

  const pagamentoPendente = await prisma.pagamento.findFirst({
    where: { status: "PENDENTE", assinatura: { motoristaId: motorista.id } },
    orderBy: { criadoEm: "desc" },
  });

  if (pagamentoPendente?.gatewayPreferenceId) {
    try {
      await confirmarPagamentoAsaas(pagamentoPendente.gatewayPreferenceId);
    } catch (err) {
      // Não propaga erro pro cliente — essa rota é só uma tentativa "a mais"
      // de reconciliar; o webhook continua sendo o caminho principal, e uma
      // falha aqui (ex: Asaas fora do ar por um instante) não deve travar a
      // navegação do motorista na tela de planos.
      console.error("[sincronizar assinatura] falha ao revalidar pagamento", err);
    }
  }

  const assinatura = await getAssinaturaAtual(motorista.id);
  return NextResponse.json({ tipoPlanoAtual: assinatura?.status === "ATIVA" ? assinatura.tipoPlano : null });
}
