import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 para evitar ambiguidade
const CODE_LENGTH = 8;
export const CONVITE_VALIDADE_DIAS = 7;

export function gerarCodigoConvite(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export function calcularExpiracaoConvite(from: Date = new Date()): Date {
  const expira = new Date(from);
  expira.setUTCDate(expira.getUTCDate() + CONVITE_VALIDADE_DIAS);
  return expira;
}

/**
 * Convites PENDENTE cuja data de expiração já passou precisam refletir
 * status EXPIRADO. Em vez de depender de um cron dedicado só para isso,
 * sincronizamos preguiçosamente sempre que convites são listados ou
 * consultados (leitura + gravação idempotente).
 */
export async function expirarConvitesVencidos(motoristaId?: string): Promise<void> {
  await prisma.convite.updateMany({
    where: {
      status: "PENDENTE",
      expiraEm: { lt: new Date() },
      ...(motoristaId ? { motoristaId } : {}),
    },
    data: { status: "EXPIRADO" },
  });
}
