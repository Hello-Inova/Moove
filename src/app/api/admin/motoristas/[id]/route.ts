import { NextRequest, NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth/guards";
import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit-log";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) return jsonError(401, "Não autenticado.");

  const { id } = await params;

  const motorista = await prisma.motorista.findUnique({ where: { id } });
  if (!motorista) return jsonError(404, "Motorista não encontrado.");

  // Todas as tabelas relacionadas (veículos, convites, vínculos, localização,
  // assinaturas/pagamentos) têm onDelete: Cascade — apagar o motorista já
  // limpa tudo ligado a ele.
  await prisma.motorista.delete({ where: { id } });

  await registrarAuditoria({
    acao: "EXCLUIR_MOTORISTA",
    entidade: "Motorista",
    entidadeId: id,
    detalhes: { nome: motorista.nome, email: motorista.email },
    request,
  });

  return NextResponse.json({ ok: true });
}
