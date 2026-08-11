import "server-only";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Rate limiting simples baseado no próprio Postgres (sem Redis/serviço
 * externo) — cada tentativa vira uma linha em `tentativas_acesso`; contamos
 * quantas existem dentro da janela e bloqueamos se passar do limite. Não é
 * o mais performático do mundo (um INSERT + um COUNT por tentativa de
 * login), mas login não é um endpoint de alto tráfego, então o custo é
 * desprezível — e evita depender de infraestrutura nova só pra isso.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSegundos: number };

export async function checarRateLimit(
  chave: string,
  opts: { max: number; janelaMinutos: number }
): Promise<RateLimitResult> {
  const desde = new Date(Date.now() - opts.janelaMinutos * 60_000);
  const total = await prisma.tentativaAcesso.count({ where: { chave, criadoEm: { gte: desde } } });

  if (total >= opts.max) {
    return { ok: false, retryAfterSegundos: opts.janelaMinutos * 60 };
  }
  return { ok: true };
}

export async function registrarTentativa(chave: string): Promise<void> {
  await prisma.tentativaAcesso.create({ data: { chave } });
}

/** IP do cliente a partir dos headers que a Vercel injeta — `NextRequest`
 * não expõe mais `.ip` diretamente (removido no Next 15). */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "desconhecido";
}

/**
 * Checa (e já registra) uma tentativa contra até 2 limites simultâneos —
 * por identificador específico (ex: e-mail, protege UMA conta de força
 * bruta) e por IP (protege contra um único atacante testando várias contas).
 * Registra a tentativa sempre que o limite não foi excedido, mesmo que a
 * senha depois esteja errada — o que importa é limitar quantas VEZES
 * alguém pode tentar, não só as falhas.
 */
export async function aplicarRateLimitLogin(params: {
  escopo: string;
  identificador: string;
  ip: string;
  porIdentificador: { max: number; janelaMinutos: number };
  porIp: { max: number; janelaMinutos: number };
}): Promise<RateLimitResult> {
  const chaveId = `${params.escopo}:id:${params.identificador}`;
  const chaveIp = `${params.escopo}:ip:${params.ip}`;

  const [porId, porIp] = await Promise.all([
    checarRateLimit(chaveId, params.porIdentificador),
    checarRateLimit(chaveIp, params.porIp),
  ]);

  if (!porId.ok) return porId;
  if (!porIp.ok) return porIp;

  await Promise.all([registrarTentativa(chaveId), registrarTentativa(chaveIp)]);
  return { ok: true };
}
