import { redirect } from "next/navigation";

import { getAuthenticatedMotorista } from "@/lib/auth/guards";
import { getPainelData, parseMesReferencia } from "@/lib/painel/dashboard-data";
import { PainelDashboard } from "@/components/motorista/PainelDashboard";

export default async function MotoristaPainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const motorista = await getAuthenticatedMotorista();
  if (!motorista) redirect("/motorista/login");

  const { mes } = await searchParams;
  const mesReferencia = parseMesReferencia(mes);
  const dados = await getPainelData(motorista.id, mesReferencia);

  return <PainelDashboard dados={dados} />;
}
