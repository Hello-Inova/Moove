import "server-only";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import type { Motorista, Responsavel } from "@prisma/client";

/**
 * Resolve o motorista autenticado a partir do cookie de sessão, batendo no
 * banco a cada chamada (não confiamos apenas no JWT — a conta pode ter sido
 * desativada). Retorna `null` se não houver sessão válida ou conta ativa.
 */
export async function getAuthenticatedMotorista(): Promise<Motorista | null> {
  const session = await getSession("motorista");
  if (!session) return null;

  const motorista = await prisma.motorista.findUnique({ where: { id: session.sub } });
  if (!motorista || motorista.statusConta !== "ATIVA") return null;

  return motorista;
}

export async function getAuthenticatedResponsavel(): Promise<Responsavel | null> {
  const session = await getSession("responsavel");
  if (!session) return null;

  const responsavel = await prisma.responsavel.findUnique({ where: { id: session.sub } });
  return responsavel;
}
