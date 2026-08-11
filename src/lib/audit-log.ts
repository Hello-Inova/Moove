import "server-only";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";

/**
 * Ações sensíveis do painel admin que ficam registradas em `logs_auditoria`.
 * Como não existe tabela de admins (credencial única e fixa), o log não
 * guarda "quem fez" — só "o que foi feito, em quem, e quando/de onde".
 */
export type AcaoAuditoria =
  | "LOGIN_ADMIN"
  | "SUSPENDER_CONTA"
  | "REATIVAR_CONTA"
  | "EXCLUIR_MOTORISTA"
  | "EXCLUIR_RESPONSAVEL"
  | "FORCAR_ASSINATURA"
  | "CRIAR_PLANO"
  | "ATUALIZAR_PLANO"
  | "ATIVAR_PLANO"
  | "DESATIVAR_PLANO"
  | "EXCLUIR_PLANO";

/**
 * Registra uma ação no log de auditoria. Nunca lança — se a gravação falhar
 * (ex: banco fora do ar), só loga no console; a ação administrativa em si
 * já foi concluída e não deve ser desfeita ou barrada por causa da
 * auditoria.
 */
export async function registrarAuditoria(params: {
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown>;
  request: NextRequest;
}): Promise<void> {
  try {
    await prisma.logAuditoria.create({
      data: {
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId ?? undefined,
        detalhes: params.detalhes as Prisma.InputJsonValue | undefined,
        ip: clientIp(params.request),
      },
    });
  } catch (err) {
    console.error("[audit-log] falha ao registrar ação de auditoria:", err);
  }
}
