import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Formato salvo em `Convite.dadosAluno` (JSON) pro fluxo de convite nominal
 * — tudo que falta pra criar o Aluno + Vinculo + ContratoTransporte quando o
 * responsável assina (ver .../convites/nominal/[codigo]/assinar). Dados do
 * responsável ficam em colunas próprias do Convite (nomeResponsavel etc.),
 * não aqui.
 */
export type DadosAlunoConviteNominal = {
  nomeAluno: string;
  escolaId: string;
  periodo: "MANHA" | "TARDE" | "INTEGRAL" | "NOITE" | null;
  valorMensalidade: number | null;
  diaPagamentoMensalidade: number | null;
  prazoMeses: 10 | 24 | null;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 para evitar ambiguidade
const CODE_LENGTH = 8;
export const CONVITE_VALIDADE_DIAS = 7;

// Convite nominal (link por e-mail/WhatsApp, ver /api/motorista/convites/
// nominal) fica válido por mais tempo que o código de compartilhamento —
// pressupõe um combinado prévio entre motorista e família, então dá mais
// folga pra completar cadastro + assinar o contrato sem precisar gerar de
// novo.
export const CONVITE_NOMINAL_VALIDADE_DIAS = 14;

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

export function calcularExpiracaoConviteNominal(from: Date = new Date()): Date {
  const expira = new Date(from);
  expira.setUTCDate(expira.getUTCDate() + CONVITE_NOMINAL_VALIDADE_DIAS);
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
