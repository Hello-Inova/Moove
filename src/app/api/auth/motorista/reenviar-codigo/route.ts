import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { reenviarCodigoSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError } from "@/lib/http";
import {
  findPendingRegistration,
  issueVerificationCode,
  EmailSendError,
  ResendCooldownError,
} from "@/lib/email/verification";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = reenviarCodigoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, proposito } = parsed.data;

  try {
    if (proposito === "CADASTRO") {
      const pendente = await findPendingRegistration(email, "motorista");
      if (!pendente) {
        return jsonError(404, "Nenhum cadastro pendente para esse e-mail. Cadastre-se novamente.");
      }
      await issueVerificationCode({
        email,
        role: "motorista",
        proposito: "CADASTRO",
        nome: pendente.nome,
        payload: pendente,
      });
    } else {
      const motorista = await prisma.motorista.findUnique({ where: { email } });
      if (!motorista) return jsonError(404, "Conta não encontrada.");
      await issueVerificationCode({ email, role: "motorista", proposito: "LOGIN", nome: motorista.nome });
    }
  } catch (err) {
    if (err instanceof ResendCooldownError) return jsonError(429, err.message);
    if (err instanceof EmailSendError) {
      return jsonError(502, "Não foi possível enviar o e-mail de verificação agora. Tente novamente em instantes.");
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}
