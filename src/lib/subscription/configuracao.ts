import "server-only";

import { prisma } from "@/lib/prisma";
import { calcularTesteExpiraEm } from "@/lib/subscription/plans";

export const PERIODO_TESTE_PADRAO_DIAS = 7;

export async function obterPeriodoTesteDias(): Promise<number> {
  const configuracao = await prisma.configuracaoSistema.findUnique({ where: { id: "global" } });
  return configuracao?.periodoTesteDias ?? PERIODO_TESTE_PADRAO_DIAS;
}

export async function calcularTesteExpiraEmConfigurado(agora = new Date()): Promise<Date> {
  return calcularTesteExpiraEm(agora, await obterPeriodoTesteDias());
}
