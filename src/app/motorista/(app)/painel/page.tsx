import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { getPainelData, getPainelDataAnual, parseMesReferencia } from "@/lib/painel/dashboard-data";
import { PainelDashboard } from "@/components/motorista/PainelDashboard";
import { PainelAnual } from "@/components/motorista/PainelAnual";
import { getAssinaturaAtual, contaEmTeste } from "@/lib/subscription/service";

export default async function MotoristaPainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const { mes, ano } = await searchParams;
  const anoAtualDoSistema = new Date().getFullYear();

  // "Todos os meses" (item 11): previsão anual em vez do recorte por mês —
  // ver getPainelDataAnual em dashboard-data.ts.
  if (mes === "todos") {
    const anoSelecionado = ano && /^\d{4}$/.test(ano) ? Number(ano) : anoAtualDoSistema;
    const dadosAnual = await getPainelDataAnual(motorista.id, anoSelecionado);
    return <PainelAnual dados={dadosAnual} anoAtualDoSistema={anoAtualDoSistema} />;
  }

  const mesReferencia = parseMesReferencia(mes);
  const [dados, assinatura] = await Promise.all([
    getPainelData(motorista.id, mesReferencia),
    getAssinaturaAtual(motorista.id),
  ]);

  // Resumo da assinatura pro card de "Plano" no Painel (ver item 4 do
  // pedido do motorista: controle da data de expiração direto no
  // dashboard, além da aba Planos).
  const assinaturaInfo = contaEmTeste(motorista.testeExpiraEm)
    ? { situacao: "TESTE" as const, planoLabel: null, expiraEm: motorista.testeExpiraEm }
    : assinatura?.status === "ATIVA"
      ? { situacao: "ATIVA" as const, planoLabel: assinatura.planoLabel, expiraEm: assinatura.expiraEm }
      : { situacao: "EXPIRADA" as const, planoLabel: assinatura?.planoLabel ?? null, expiraEm: null };

  return <PainelDashboard dados={dados} motoristaChavePix={motorista.chavePix} assinaturaInfo={assinaturaInfo} />;
}
