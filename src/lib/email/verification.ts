import "server-only";

import { randomInt } from "crypto";
import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail, EmailSendError, type VerificationPurpose } from "@/lib/email/mailer";

export type { VerificationPurpose };
export { EmailSendError };
export type VerificationRole = "motorista" | "responsavel";

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;

export class ResendCooldownError extends Error {}

function hashCode(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}

function generateCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
}

/**
 * Gera e envia um novo código de verificação por e-mail, respeitando um
 * intervalo mínimo entre envios (protege a cota gratuita do provedor de
 * e-mail e evita abuso). `payload` só é usado no propósito CADASTRO: guarda
 * os dados da conta pendente até o código ser confirmado, já que a conta
 * ainda não existe nesse momento.
 */
export async function issueVerificationCode(params: {
  email: string;
  role: VerificationRole;
  proposito: VerificationPurpose;
  nome: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { email, role, proposito, nome, payload } = params;

  const ultimo = await prisma.codigoVerificacao.findFirst({
    where: { email, role, proposito, usadoEm: null },
    orderBy: { criadoEm: "desc" },
  });

  if (ultimo && Date.now() - ultimo.criadoEm.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
    const restante = Math.ceil(
      (RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - ultimo.criadoEm.getTime())) / 1000
    );
    throw new ResendCooldownError(`Aguarde ${restante}s antes de pedir um novo código.`);
  }

  const codigo = generateCode();

  await prisma.codigoVerificacao.create({
    data: {
      email,
      role,
      proposito,
      codigoHash: hashCode(codigo),
      payload: payload as Prisma.InputJsonValue | undefined,
      expiraEm: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    },
  });

  await sendVerificationEmail({ to: email, nome, codigo, proposito });
}

export type VerifyCodeResult =
  | { ok: true; payload: Record<string, unknown> | null }
  | { ok: false; error: string };

/** Valida o código mais recente ainda não usado para esse e-mail/role/propósito. */
export async function verifyCode(params: {
  email: string;
  role: VerificationRole;
  proposito: VerificationPurpose;
  codigo: string;
}): Promise<VerifyCodeResult> {
  const { email, role, proposito, codigo } = params;

  const registro = await prisma.codigoVerificacao.findFirst({
    where: { email, role, proposito, usadoEm: null },
    orderBy: { criadoEm: "desc" },
  });

  if (!registro) {
    return { ok: false, error: "Nenhum código pendente para esse e-mail. Solicite um novo." };
  }
  if (registro.expiraEm.getTime() < Date.now()) {
    return { ok: false, error: "Código expirado. Solicite um novo." };
  }
  if (registro.tentativas >= MAX_ATTEMPTS) {
    return { ok: false, error: "Muitas tentativas com esse código. Solicite um novo." };
  }

  if (hashCode(codigo) !== registro.codigoHash) {
    await prisma.codigoVerificacao.update({
      where: { id: registro.id },
      data: { tentativas: { increment: 1 } },
    });
    return { ok: false, error: "Código incorreto." };
  }

  await prisma.codigoVerificacao.update({
    where: { id: registro.id },
    data: { usadoEm: new Date() },
  });

  return { ok: true, payload: (registro.payload as Record<string, unknown> | null) ?? null };
}

/** Payload de cadastro pendente mais recente para esse e-mail (usado no reenvio). */
export async function findPendingRegistration(
  email: string,
  role: VerificationRole
): Promise<{ nome: string; telefone: string; senhaHash: string } | null> {
  const registro = await prisma.codigoVerificacao.findFirst({
    where: { email, role, proposito: "CADASTRO", usadoEm: null },
    orderBy: { criadoEm: "desc" },
  });
  if (!registro?.payload) return null;
  return registro.payload as { nome: string; telefone: string; senhaHash: string };
}
