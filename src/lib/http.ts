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
