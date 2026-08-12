import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { resumoUsoApis } from "@/lib/uso-api-externa";

/** Resumo do uso mensal das APIs pagas do Google — consumido pelo banner de
 * aviso do AdminShell (fetch client-side) e reaproveitável por qualquer
 * outra tela do admin que precise do mesmo dado. A página de detalhe
 * (`/admin/uso-google`) busca direto via Prisma (server component), sem
 * passar por esse endpoint. */
export async function GET() {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const resumo = await resumoUsoApis();
  return NextResponse.json(resumo);
}
