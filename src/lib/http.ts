import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonValidationError(error: ZodError) {
  return NextResponse.json(
    { error: "Dados inválidos.", issues: error.flatten().fieldErrors },
    { status: 400 }
  );
}

/** 429 com header `Retry-After` — usado pelo rate limiting de login (ver
 * src/lib/rate-limit.ts). */
export function jsonRateLimited(retryAfterSegundos: number, message?: string) {
  return NextResponse.json(
    {
      error:
        message ??
        `Muitas tentativas. Aguarde ${Math.ceil(retryAfterSegundos / 60)} min antes de tentar de novo.`,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterSegundos) } }
  );
}
