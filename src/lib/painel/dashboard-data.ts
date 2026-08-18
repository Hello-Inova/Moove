import "server-only";

import { prisma } from "@/lib/prisma";

export type StatusMensalidade = "PENDENTE" | "PAGO" | "CANCELADO";

export type MensalidadeResumo = {
  id: string;
  alunoNome: string;
  escolaNome: string | null;
  valor: number;
  status: StatusMensalidade;
  mesReferencia: Date;
  vencimento: Date;
  pagoEm: Date | null;
  atrasado: boolean;
  responsavelNome: string;
  responsavelTelefone: string;
};

export type AlunoResumo = { id: string; nome: string; escolaNome: string | null };
export type EscolaResumo = { id: string; nome: string; alunos: number };
export type KmDia = { data: Date; km: number };

export type CardResumo<T> = { total: number; detalhes: T[] };

export type PainelData = {
  mesReferencia: Date;
  alunosVinculados: CardResumo<AlunoResumo>;
  escolasVinculadas: CardResumo<EscolaResumo>;
  entradaPrevista: CardResumo<MensalidadeResumo>;
  pagamentosRecebidos: CardResumo<MensalidadeResumo>;
  pagamentosPendentes: CardResumo<MensalidadeResumo>;
  pagamentosAtrasados: CardResumo<MensalidadeResumo>;
  kmUltimos30Dias: CardResumo<KmDia>;
};

function ultimoDiaDoMes(ano: number, mesIndiceZero: number): number {
  return new Date(ano, mesIndiceZero + 1, 0).getDate();
}

function somaValor(lista: MensalidadeResumo[]): number {
  return lista.reduce((acc, m) => acc + m.valor, 0);
}

/**
 * Primeiro dia do mês de referência a partir de um parâmetro "YYYY-MM" vindo
 * da URL (filtro de mês do painel) — cai pro mês atual se vier ausente ou
 * mal formatado, pra nunca quebrar a página com um querystring inválido.
 */
export function parseMesReferencia(mesParam: string | undefined): Date {
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const [ano, mes] = mesParam.split("-").map(Number);
    if (mes >= 1 && mes <= 12) return new Date(ano, mes - 1, 1);
  }
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
}

export function formatarMesParam(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Agrega os dados do Painel (Dashboard financeiro/operacional do motorista)
 * para um mês de referência específico — todo card respeita o mês
 * selecionado, EXCETO "km rodados", que é deliberadamente uma janela móvel
 * dos últimos 30 dias corridos a partir de hoje (é o que o rótulo diz, e não
 * faz sentido "km dos últimos 30 dias de janeiro de 2025").
 *
 * "Atrasado" vs "Pendente": cada vínculo tem um dia de vencimento próprio
 * (`diaPagamentoMensalidade`, 1–31, truncado pro último dia do mês quando o
 * mês de referência for mais curto). Uma MensalidadeTransporte só é GERADA
 * pelo cron quando esse dia já chegou (ver
 * src/lib/mensalidade/mensalidade-transporte.ts), então o corte real entre
 * "pendente" (ainda dentro do prazo) e "atrasado" (venceu e não foi pago) é
 * comparar essa data de vencimento com a data de HOJE — não com o mês
 * filtrado. Isso é o que permite, por exemplo, ver o mês corrente com
 * mensalidades "pendentes" logo no dia do vencimento, e um mês passado com
 * tudo que não foi pago aparecendo corretamente como "atrasado".
 */
export async function getPainelData(motoristaId: string, mesReferencia: Date): Promise<PainelData> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const inicioMes = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1);
  const fimMesExclusivo = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth() + 1, 1);
  const ultimoDia = ultimoDiaDoMes(mesReferencia.getFullYear(), mesReferencia.getMonth());

  // `PercursoDia.data` é `@db.Date` — comparar em UTC truncado, mesmo padrão
  // usado em toda a base pra esse tipo de coluna (ver `hojeData()` em
  // src/lib/percurso.ts, src/app/api/motorista/rota/route.ts etc.), pra não
  // depender do fuso horário de onde a função roda.
  const hojeUTC = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  const inicioJanela30d = new Date(hojeUTC);
  inicioJanela30d.setUTCDate(inicioJanela30d.getUTCDate() - 29);

  const [vinculosDoMes, escolas, mensalidades, percursos] = await Promise.all([
    // Vínculos "vigentes" em algum ponto do mês selecionado: criados até o
    // fim do mês e (ainda ativos OU revogados depois do início do mês) —
    // é o que dá pro filtro de mês fazer sentido também nesses dois cards
    // de contagem, não só nos financeiros.
    prisma.vinculo.findMany({
      where: {
        motoristaId,
        criadoEm: { lt: fimMesExclusivo },
        OR: [{ revogadoEm: null }, { revogadoEm: { gte: inicioMes } }],
      },
      select: {
        id: true,
        aluno: { select: { nome: true } },
        escola: { select: { id: true, nome: true } },
      },
    }),
    prisma.escola.findMany({ where: { motoristaId }, select: { id: true, nome: true } }),
    prisma.mensalidadeTransporte.findMany({
      where: { motoristaId, mesReferencia: inicioMes },
      select: {
        id: true,
        valor: true,
        status: true,
        pagoEm: true,
        vinculo: {
          select: {
            diaPagamentoMensalidade: true,
            aluno: { select: { nome: true } },
            escola: { select: { nome: true } },
            responsavel: { select: { nome: true, telefone: true } },
          },
        },
      },
    }),
    prisma.percursoDia.findMany({
      where: { motoristaId, data: { gte: inicioJanela30d, lte: hojeUTC } },
      select: { data: true, distanciaMetros: true },
    }),
  ]);

  const alunosDetalhes: AlunoResumo[] = vinculosDoMes.map((v) => ({
    id: v.id,
    nome: v.aluno.nome,
    escolaNome: v.escola?.nome ?? null,
  }));

  const escolasDetalhes: EscolaResumo[] = escolas
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      alunos: vinculosDoMes.filter((v) => v.escola?.id === e.id).length,
    }))
    .filter((e) => e.alunos > 0);

  const mensalidadesResumo: MensalidadeResumo[] = mensalidades
    .filter((m) => m.status !== "CANCELADO")
    .map((m) => {
      const diaVencimento = Math.min(m.vinculo.diaPagamentoMensalidade ?? ultimoDia, ultimoDia);
      const vencimento = new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), diaVencimento);
      const atrasado = m.status === "PENDENTE" && vencimento < hoje;
      return {
        id: m.id,
        alunoNome: m.vinculo.aluno.nome,
        escolaNome: m.vinculo.escola?.nome ?? null,
        valor: Number(m.valor),
        status: m.status,
        mesReferencia: inicioMes,
        vencimento,
        pagoEm: m.pagoEm,
        atrasado,
        responsavelNome: m.vinculo.responsavel.nome,
        responsavelTelefone: m.vinculo.responsavel.telefone,
      };
    })
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime());

  const recebidos = mensalidadesResumo.filter((m) => m.status === "PAGO");
  const atrasados = mensalidadesResumo.filter((m) => m.atrasado);
  const pendentesNoPrazo = mensalidadesResumo.filter((m) => m.status === "PENDENTE" && !m.atrasado);

  const kmDetalhes: KmDia[] = percursos
    .map((p) => ({ data: p.data, km: (p.distanciaMetros ?? 0) / 1000 }))
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  return {
    mesReferencia: inicioMes,
    alunosVinculados: { total: alunosDetalhes.length, detalhes: alunosDetalhes },
    escolasVinculadas: { total: escolasDetalhes.length, detalhes: escolasDetalhes },
    entradaPrevista: { total: somaValor(mensalidadesResumo), detalhes: mensalidadesResumo },
    pagamentosRecebidos: { total: somaValor(recebidos), detalhes: recebidos },
    pagamentosPendentes: { total: somaValor(pendentesNoPrazo), detalhes: pendentesNoPrazo },
    pagamentosAtrasados: { total: somaValor(atrasados), detalhes: atrasados },
    kmUltimos30Dias: {
      total: kmDetalhes.reduce((acc, d) => acc + d.km, 0),
      detalhes: kmDetalhes,
    },
  };
}
