import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { redefinirSenhaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError, jsonRateLimited } from "@/lib/http";
import { verifyCode } from "@/lib/email/verification";
import { aplicarRateLimitLogin, clientIp } from "@/lib/rate-limit";

/**
 * Segunda etapa da recuperação de senha: confirma o código enviado por
 * e-mail e, se válido, já troca a senha da conta. Faz login automático em
 * seguida (mesmo padrão do cadastro), já que o e-mail acabou de ser
 * reconfirmado por posse da caixa de entrada.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = redefinirSenhaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, codigo, novaSenha } = parsed.data;

  const rateLimit = await aplicarRateLimitLogin({
    escopo: "recuperar-senha:motorista:confirmar",
    identificador: email,
    ip: clientIp(request),
    porIdentificador: { max: 10, janelaMinutos: 15 },
    porIp: { max: 30, janelaMinutos: 15 },
  });
  if (!rateLimit.ok) return jsonRateLimited(rateLimit.retryAfterSegundos);

  const resultado = await verifyCode({ email, role: "motorista", proposito: "RECUPERAR_SENHA", codigo });
  if (!resultado.ok) return jsonError(400, resultado.error);

  const motorista = await prisma.motorista.findUnique({ where: { email } });
  if (!motorista) return jsonError(404, "Conta não encontrada.");

  const senhaHash = await hashPassword(novaSenha);
  await prisma.motorista.update({ where: { id: motorista.id }, data: { senhaHash } });

  await createSession("motorista", motorista.id);

  return NextResponse.json({ id: motorista.id, nome: motorista.nome, email: motorista.email });
}
