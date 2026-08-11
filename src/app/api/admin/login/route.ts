import { timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

import { jsonError, jsonValidationError, jsonRateLimited } from "@/lib/http";
import { adminLoginSchema } from "@/lib/validation/schemas";
import { createSession } from "@/lib/auth/session";
import { aplicarRateLimitLogin, clientIp } from "@/lib/rate-limit";
import { registrarAuditoria } from "@/lib/audit-log";

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminSenha = process.env.ADMIN_SENHA;
  if (!adminEmail || !adminSenha) {
    return jsonError(503, "Login de administrador ainda não configurado neste ambiente.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "Corpo da requisição inválido.");

  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const { email, senha } = parsed.data;

  // Credencial única e fixa (sem tabela de admins) — o alvo de força bruta
  // mais valioso do sistema, então o limite aqui é o mais rígido de todos.
  const rateLimit = await aplicarRateLimitLogin({
    escopo: "login:admin",
    identificador: "admin",
    ip: clientIp(request),
    porIdentificador: { max: 5, janelaMinutos: 15 },
    porIp: { max: 5, janelaMinutos: 15 },
  });
  if (!rateLimit.ok) return jsonRateLimited(rateLimit.retryAfterSegundos);

  const emailOk = timingSafeCompare(email, adminEmail.toLowerCase());
  const senhaOk = timingSafeCompare(senha, adminSenha);

  if (!emailOk || !senhaOk) {
    return jsonError(401, "E-mail ou senha inválidos.");
  }

  await createSession("admin", "admin");

  await registrarAuditoria({ acao: "LOGIN_ADMIN", entidade: "Admin", request });

  return NextResponse.json({ ok: true });
}
