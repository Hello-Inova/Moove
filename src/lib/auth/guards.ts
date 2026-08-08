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

/**
 * Não existe tabela de admin no banco — é uma credencial única, fixa por
 * variável de ambiente (ADMIN_EMAIL/ADMIN_SENHA). A sessão já é assinada
 * pelo próprio servidor (AUTH_SECRET_ADMIN), então validar o JWT já basta.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getSession("admin");
  return session !== null;
}

export async function getAuthenticatedResponsavel(): Promise<Responsavel | null> {
  const session = await getSession("responsavel");
  if (!session) return null;

  const responsavel = await prisma.responsavel.findUnique({ where: { id: session.sub } });
  if (!responsavel || responsavel.statusConta !== "ATIVA") return null;

  return responsavel;
}
