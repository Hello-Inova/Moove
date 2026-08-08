import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "motorista" | "responsavel" | "admin";

export type SessionPayload = {
  sub: string; // id do usuário (motorista ou responsavel) — "admin" para a role admin
  role: Role;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

const COOKIE_NAMES: Record<Role, string> = {
  motorista: "moove_motorista_session",
  responsavel: "moove_responsavel_session",
  admin: "moove_admin_session",
};

const SECRET_ENV_VARS: Record<Role, string> = {
  motorista: "AUTH_SECRET_MOTORISTA",
  responsavel: "AUTH_SECRET_RESPONSAVEL",
  admin: "AUTH_SECRET_ADMIN",
};

function getSecret(role: Role): Uint8Array {
  const envVar = SECRET_ENV_VARS[role];
  const secret = process.env[envVar];
  if (!secret) {
    throw new Error(`Variável de ambiente ${envVar} não configurada.`);
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(role: Role, userId: string): Promise<void> {
  const token = await new SignJWT({ role } satisfies Pick<SessionPayload, "role">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret(role));

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAMES[role], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(role: Role): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAMES[role]);
}

/**
 * Lê e valida a sessão a partir do cookie httpOnly. Retorna `null` se não
 * houver sessão válida — nunca lança para requisições sem sessão, para que
 * os call sites decidam como responder (401, redirect, etc.).
 */
export async function getSession(role: Role): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAMES[role])?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(role));
    if (payload.role !== role || typeof payload.sub !== "string") {
      return null;
    }
    return { sub: payload.sub, role };
  } catch {
    return null;
  }
}

export function sessionCookieName(role: Role): string {
  return COOKIE_NAMES[role];
}
