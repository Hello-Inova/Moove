import "server-only";

import { prisma } from "@/lib/prisma";

export function adicionarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

/**
 * Motor de cobrança por aluno — chamado pelo cron diário (ver
 * /api/cron/cobrancas-aluno e vercel.json). Não cobra o responsável em
 * nenhum momento: quem é cobrado é o motorista, por aluno vinculado além da
 * faixa grátis do seu plano, a cada 30 dias completos de vínculo.
 *
 * Regras (ver comentários no schema, models Vinculo/Assinatura/CobrancaAluno):
 * - Só entra na conta um vínculo com status ATIVO. Um vínculo revogado antes
 *   do corte de 30 dias simplesmente nunca é avaliado de novo — evita cobrar
 *   período incompleto/indevido.
 * - A faixa grátis é dinâmica: entre os vínculos ATIVOS de um motorista, os
 *   `alunosGratis` mais antigos (por `criadoEm`) não geram cobrança; os
 *   demais geram uma CobrancaAluno de `valorPorAlunoExcedente` a cada corte.
 *   Como o ranking é reavaliado a cada corte, revogar um vínculo antigo
 *   promove automaticamente o próximo da fila pra faixa grátis no ciclo
 *   seguinte.
 * - Sem Assinatura ATIVA (motorista em teste grátis, sem plano, ou com
 *   assinatura expirada/cancelada), nenhuma cobrança é gerada — só o corte é
 *   reagendado, pra não acumular cobrança retroativa se o motorista assinar
 *   um plano depois.
 * - `proximaCobrancaEm` sempre avança (nunca fica travado): se o cron ficar
 *   um tempo sem rodar e mais de um corte de 30 dias já tiver passado, cada
 *   corte vencido é avaliado (e cobrado, se for o caso) individualmente até
 *   alcançar a data atual.
 */
export async function processarCobrancasAlunoVencidas(
  agora: Date = new Date()
): Promise<{ vinculosAvaliados: number; cobrancasGeradas: number }> {
  const vinculosVencidos = await prisma.vinculo.findMany({
    where: { status: "ATIVO", proximaCobrancaEm: { lte: agora } },
    select: { id: true, motoristaId: true, proximaCobrancaEm: true },
  });

  if (vinculosVencidos.length === 0) {
    return { vinculosAvaliados: 0, cobrancasGeradas: 0 };
  }

  const motoristaIds = [...new Set(vinculosVencidos.map((v) => v.motoristaId))];
  let cobrancasGeradas = 0;

  for (const motoristaId of motoristaIds) {
    // Assinatura ATIVA do motorista (se houver) — define alunosGratis e
    // valorPorAlunoExcedente vigentes (snapshot da assinatura, não do
    // catálogo — ver comentário no schema).
    const assinatura = await prisma.assinatura.findFirst({
      where: { motoristaId, status: "ATIVA" },
      orderBy: { criadoEm: "desc" },
    });

    // Ranking dinâmico dos vínculos ATIVOS deste motorista, do mais antigo
    // pro mais novo — os primeiros `alunosGratis` ficam de fora da cobrança.
    const vinculosAtivosOrdenados = await prisma.vinculo.findMany({
      where: { motoristaId, status: "ATIVO" },
      select: { id: true },
      orderBy: { criadoEm: "asc" },
    });
    const idsGratis = new Set(vinculosAtivosOrdenados.slice(0, assinatura?.alunosGratis ?? 0).map((v) => v.id));

    const vinculosDoMotorista = vinculosVencidos.filter((v) => v.motoristaId === motoristaId);

    for (const vinculo of vinculosDoMotorista) {
      if (!vinculo.proximaCobrancaEm) continue;

      const billable = assinatura !== null && !idsGratis.has(vinculo.id);
      let cicloFim = vinculo.proximaCobrancaEm;

      // Cobre o caso de mais de um corte de 30 dias já ter vencido (cron
      // parado por um tempo) — gera uma CobrancaAluno por corte vencido,
      // sempre avançando a partir da data original (sem drift).
      while (cicloFim.getTime() <= agora.getTime()) {
        if (billable && assinatura) {
          const cicloInicio = adicionarDias(cicloFim, -30);
          await prisma.cobrancaAluno.create({
            data: {
              vinculoId: vinculo.id,
              motoristaId,
              cicloInicio,
              cicloFim,
              valor: assinatura.valorPorAlunoExcedente,
              status: "PENDENTE",
            },
          });
          cobrancasGeradas++;
        }
        cicloFim = adicionarDias(cicloFim, 30);
      }

      await prisma.vinculo.update({
        where: { id: vinculo.id },
        data: { proximaCobrancaEm: cicloFim },
      });
    }
  }

  return { vinculosAvaliados: vinculosVencidos.length, cobrancasGeradas };
}
