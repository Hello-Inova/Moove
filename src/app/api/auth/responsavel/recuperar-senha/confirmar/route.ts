import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { redefinirSenhaSchema } from "@/lib/validation/schemas";
import { jsonError, jsonValidationError, jsonRateLimited } from "@/lib/http";
import { verifyCode } from "@/lib/email/verification";
import { aplicarRateLimitLogin, clientIp } from "@/lib/rate-limit";

/**
 * Segunda etapa da recuperação de senha: confirma o código enviado por
 * e-mail e, se válido, já troca a senha da conta. NÃO faz login automático —
 * o usuário é redirecionado para a tela de login para entrar com a senha
 * nova (ver RecuperarSenhaForm.tsx), já que o código nesse ponto já foi
 * validado antes na etapa intermediária (ver validar-codigo/route.ts).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = redefinirSenhaSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, codigo, novaSenha } = parsed.data;

  const rateLimit = await aplicarRateLimitLogin({
    escopo: "recuperar-senha:responsavel:confirmar",
    identificador: email,
    ip: clientIp(request),
    porIdentificador: { max: 10, janelaMinutos: 15 },
    porIp: { max: 30, janelaMinutos: 15 },
  });
  if (!rateLimit.ok) return jsonRateLimited(rateLimit.retryAfterSegundos);

  const resultado = await verifyCode({ email, role: "responsavel", proposito: "RECUPERAR_SENHA", codigo });
  if (!resultado.ok) return jsonError(400, resultado.error);

  const responsavel = await prisma.responsavel.findUnique({ where: { email } });
  if (!responsavel) return jsonError(404, "Conta não encontrada.");

  const senhaHash = await hashPassword(novaSenha);
  await prisma.responsavel.update({ where: { id: responsavel.id }, data: { senhaHash } });

  return NextResponse.json({ email: responsavel.email });
}
