import "server-only";

import { prisma } from "@/lib/prisma";
import type { PlanoAssinatura as PlanoAssinaturaRow } from "@prisma/client";
import type { CicloCobranca, PlanoDefinicao, PublicoPlano } from "@/lib/subscription/plans";

function paraDefinicao(row: PlanoAssinaturaRow): PlanoDefinicao {
  return {
    id: row.id,
    codigo: row.codigo,
    label: row.label,
    publico: row.publico as PublicoPlano,
    ciclo: row.cicloCobranca as CicloCobranca,
    cicloLabel: row.cicloLabel,
    valorBase: Number(row.valorBase),
    alunosGratis: row.alunosGratis,
    valorPorAlunoExcedente: Number(row.valorPorAlunoExcedente),
    recursos: Array.isArray(row.recursos) ? (row.recursos as string[]) : [],
    permiteAnosAdicionais: row.permiteAnosAdicionais,
    destaque: row.destaque,
    ativo: row.ativo,
    ordem: row.ordem,
  };
}

/** Planos visíveis na vitrine (motorista ou responsável) — só os ativos, em ordem. */
export async function listarPlanosAtivos(publico?: PublicoPlano): Promise<PlanoDefinicao[]> {
  const rows = await prisma.planoAssinatura.findMany({
    where: { ativo: true, ...(publico ? { publico } : {}) },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
  });
  return rows.map(paraDefinicao);
}

/** Todos os planos (inclusive inativos) — uso exclusivo do painel admin. */
export async function listarTodosPlanos(publico?: PublicoPlano): Promise<PlanoDefinicao[]> {
  const rows = await prisma.planoAssinatura.findMany({
    where: publico ? { publico } : undefined,
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
  });
  return rows.map(paraDefinicao);
}

export async function buscarPlanoPorCodigo(codigo: string): Promise<PlanoDefinicao | null> {
  const row = await prisma.planoAssinatura.findUnique({ where: { codigo } });
  return row ? paraDefinicao(row) : null;
}

export async function buscarPlanoPorId(id: string): Promise<PlanoDefinicao | null> {
  const row = await prisma.planoAssinatura.findUnique({ where: { id } });
  return row ? paraDefinicao(row) : null;
}

export type PlanoInput = {
  codigo: string;
  label: string;
  publico: PublicoPlano;
  ciclo: CicloCobranca;
  cicloLabel: string;
  valorBase: number;
  alunosGratis: number;
  valorPorAlunoExcedente: number;
  recursos: string[];
  permiteAnosAdicionais: boolean;
  destaque?: string | null;
  ativo: boolean;
  ordem?: number;
};

export class PlanoCodigoDuplicadoError extends Error {}
export class PlanoEmUsoError extends Error {}

export async function criarPlano(input: PlanoInput): Promise<PlanoDefinicao> {
  const existente = await prisma.planoAssinatura.findUnique({ where: { codigo: input.codigo } });
  if (existente) throw new PlanoCodigoDuplicadoError(`Já existe um plano com o código "${input.codigo}".`);

  const row = await prisma.planoAssinatura.create({
    data: {
      codigo: input.codigo,
      label: input.label,
      publico: input.publico,
      cicloCobranca: input.ciclo,
      cicloLabel: input.cicloLabel,
      valorBase: input.valorBase,
      alunosGratis: input.alunosGratis,
      valorPorAlunoExcedente: input.valorPorAlunoExcedente,
      recursos: input.recursos,
      permiteAnosAdicionais: input.permiteAnosAdicionais,
      destaque: input.destaque || null,
      ativo: input.ativo,
      ordem: input.ordem ?? 0,
    },
  });
  return paraDefinicao(row);
}

export async function atualizarPlano(id: string, input: PlanoInput): Promise<PlanoDefinicao> {
  const duplicado = await prisma.planoAssinatura.findFirst({ where: { codigo: input.codigo, id: { not: id } } });
  if (duplicado) throw new PlanoCodigoDuplicadoError(`Já existe um plano com o código "${input.codigo}".`);

  const row = await prisma.planoAssinatura.update({
    where: { id },
    data: {
      codigo: input.codigo,
      label: input.label,
      publico: input.publico,
      cicloCobranca: input.ciclo,
      cicloLabel: input.cicloLabel,
      valorBase: input.valorBase,
      alunosGratis: input.alunosGratis,
      valorPorAlunoExcedente: input.valorPorAlunoExcedente,
      recursos: input.recursos,
      permiteAnosAdicionais: input.permiteAnosAdicionais,
      destaque: input.destaque || null,
      ativo: input.ativo,
      ordem: input.ordem ?? 0,
    },
  });
  return paraDefinicao(row);
}

export async function definirAtivoPlano(id: string, ativo: boolean): Promise<PlanoDefinicao> {
  const row = await prisma.planoAssinatura.update({ where: { id }, data: { ativo } });
  return paraDefinicao(row);
}

/**
 * Exclusão definitiva só é permitida se nenhuma Assinatura já usou esse
 * plano (o código fica gravado na Assinatura como snapshot histórico). Se
 * houver histórico, orientamos a desativar em vez de excluir.
 */
export async function excluirPlano(id: string): Promise<void> {
  const plano = await prisma.planoAssinatura.findUnique({ where: { id } });
  if (!plano) return;

  const emUso = await prisma.assinatura.findFirst({ where: { tipoPlano: plano.codigo } });
  if (emUso) {
    throw new PlanoEmUsoError(
      "Este plano já foi usado em pelo menos uma assinatura e não pode ser excluído — desative-o para escondê-lo da vitrine sem perder o histórico."
    );
  }

  await prisma.planoAssinatura.delete({ where: { id } });
}
