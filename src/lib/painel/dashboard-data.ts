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
  kmRodados: CardResumo<KmDia>;
};

// Todo `Date` que representa um MÊS/DIA de calendário (não um instante) é
// construído com `Date.UTC` e lido com os getters `UTC*` neste arquivo — o
// mesmo vale no client (PainelDashboard.tsx). Misturar local com UTC aqui
// causava o filtro de mês mostrar o mês anterior ao selecionado: meia-noite
// UTC do dia 1 vira 21h do dia 31 do mês anterior em fusos negativos (ex.:
// Brasil, UTC-3), e ler isso com getters locais devolve o mês errado.
function ultimoDiaDoMes(ano: number, mesIndiceZero: number): number {
  return new Date(Date.UTC(ano, mesIndiceZero + 1, 0)).getUTCDate();
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
    if (mes >= 1 && mes <= 12) return new Date(Date.UTC(ano, mes - 1, 1));
  }
  const hoje = new Date();
  return new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
}

export function formatarMesParam(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type MesAnual = {
  mes: number; // 1-12
  entradaPrevista: number;
  recebido: number;
  pendente: number;
  atrasado: number;
  kmRodados: number;
  gerado: boolean; // true = já tem MensalidadeTransporte gerada pelo cron; false = valor só projetado
};

export type PainelDataAnual = {
  ano: number;
  porMes: MesAnual[];
  totalEntradaPrevista: number;
  totalRecebido: number;
  totalPendente: number;
  totalAtrasado: number;
  totalKmRodados: number;
  alunosAtivos: number;
  escolasAtivas: number;
};

/**
 * Previsão anual do Painel (item 11 do pedido): soma os 12 meses do ano
 * informado. Pros meses que o cron já gerou `MensalidadeTransporte`, usa os
 * valores reais (mesmo critério "atrasado" de `getPainelData`). Pros meses
 * ainda não gerados (mês corrente em diante), projeta a partir do
 * `valorMensalidade` de cada vínculo cuja vigência (`vigenciaInicio`/
 * `vigenciaFim`, cadastradas no perfil do aluno) cobre aquele mês — é isso
 * que permite ver o ano inteiro mesmo pra meses futuros, e some
 * automaticamente da previsão os meses depois do fim da vigência.
 */
export async function getPainelDataAnual(motoristaId: string, ano: number): Promise<PainelDataAnual> {
  const inicioAno = new Date(Date.UTC(ano, 0, 1));
  const fimAnoExclusivo = new Date(Date.UTC(ano + 1, 0, 1));

  const hoje = new Date();
  const hojeUTC = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));

  const [vinculos, mensalidades, percursos] = await Promise.all([
    prisma.vinculo.findMany({
      where: { motoristaId },
      select: {
        id: true,
        status: true,
        alunoId: true,
        escolaId: true,
        valorMensalidade: true,
        diaPagamentoMensalidade: true,
        vigenciaInicio: true,
        vigenciaFim: true,
      },
    }),
    prisma.mensalidadeTransporte.findMany({
      where: { motoristaId, mesReferencia: { gte: inicioAno, lt: fimAnoExclusivo }, status: { not: "CANCELADO" } },
      select: { valor: true, status: true, mesReferencia: true, vinculoId: true },
    }),
    prisma.percursoDia.findMany({
      where: { motoristaId, data: { gte: inicioAno, lt: fimAnoExclusivo } },
      select: { data: true, distanciaMetros: true },
    }),
  ]);

  const porMes: MesAnual[] = [];

  for (let mesIndiceZero = 0; mesIndiceZero < 12; mesIndiceZero++) {
    const inicioMes = new Date(Date.UTC(ano, mesIndiceZero, 1));
    const fimMesExclusivo = new Date(Date.UTC(ano, mesIndiceZero + 1, 1));
    const ultimoDia = ultimoDiaDoMes(ano, mesIndiceZero);

    const mensalidadesDoMes = mensalidades.filter((m) => m.mesReferencia.getTime() === inicioMes.getTime());

    const kmDoMes = percursos
      .filter((p) => p.data >= inicioMes && p.data < fimMesExclusivo)
      .reduce((acc, p) => acc + (p.distanciaMetros ?? 0) / 1000, 0);

    if (mensalidadesDoMes.length > 0) {
      let recebido = 0;
      let pendente = 0;
      let atrasado = 0;
      for (const m of mensalidadesDoMes) {
        const valor = Number(m.valor);
        if (m.status === "PAGO") {
          recebido += valor;
          continue;
        }
        const vinculo = vinculos.find((v) => v.id === m.vinculoId);
        const diaVencimento = Math.min(vinculo?.diaPagamentoMensalidade ?? ultimoDia, ultimoDia);
        const vencimento = new Date(Date.UTC(ano, mesIndiceZero, diaVencimento));
        if (vencimento < hojeUTC) atrasado += valor;
        else pendente += valor;
      }
      porMes.push({
        mes: mesIndiceZero + 1,
        entradaPrevista: recebido + pendente + atrasado,
        recebido,
        pendente,
        atrasado,
        kmRodados: kmDoMes,
        gerado: true,
      });
    } else {
      // Ainda não gerado pelo cron — projeta com base nos vínculos vigentes
      // nesse mês (respeitando início/fim de vigência do perfil do aluno).
      const previsto = vinculos
        .filter((v) => v.status === "ATIVO" && v.valorMensalidade)
        .filter((v) => {
          const inicioVigencia = v.vigenciaInicio ?? null;
          const fimVigencia = v.vigenciaFim ?? null;
          if (inicioVigencia && inicioVigencia > fimMesExclusivo) return false;
          if (fimVigencia && fimVigencia < inicioMes) return false;
          return true;
        })
        .reduce((acc, v) => acc + Number(v.valorMensalidade ?? 0), 0);

      porMes.push({
        mes: mesIndiceZero + 1,
        entradaPrevista: previsto,
        recebido: 0,
        pendente: 0,
        atrasado: 0,
        kmRodados: kmDoMes,
        gerado: false,
      });
    }
  }

  return {
    ano,
    porMes,
    totalEntradaPrevista: porMes.reduce((acc, m) => acc + m.entradaPrevista, 0),
    totalRecebido: porMes.reduce((acc, m) => acc + m.recebido, 0),
    totalPendente: porMes.reduce((acc, m) => acc + m.pendente, 0),
    totalAtrasado: porMes.reduce((acc, m) => acc + m.atrasado, 0),
    totalKmRodados: porMes.reduce((acc, m) => acc + m.kmRodados, 0),
    alunosAtivos: new Set(vinculos.filter((v) => v.status === "ATIVO").map((v) => v.alunoId)).size,
    escolasAtivas: new Set(vinculos.filter((v) => v.status === "ATIVO" && v.escolaId).map((v) => v.escolaId)).size,
  };
}

/**
 * Agrega os dados do Painel (Dashboard financeiro/operacional do motorista)
 * para um mês de referência específico — todo card, incluindo "km
 * rodados", respeita o mês selecionado.
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

  const inicioMes = new Date(Date.UTC(mesReferencia.getUTCFullYear(), mesReferencia.getUTCMonth(), 1));
  const fimMesExclusivo = new Date(Date.UTC(mesReferencia.getUTCFullYear(), mesReferencia.getUTCMonth() + 1, 1));
  const ultimoDia = ultimoDiaDoMes(mesReferencia.getUTCFullYear(), mesReferencia.getUTCMonth());

  // `PercursoDia.data` é `@db.Date` — comparar em UTC truncado, mesmo padrão
  // usado em toda a base pra esse tipo de coluna (ver `hojeData()` em
  // src/lib/percurso.ts, src/app/api/motorista/rota/route.ts etc.), pra não
  // depender do fuso horário de onde a função roda.
  const hojeUTC = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));

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
    // Km rodados também segue o mês selecionado, igual aos cards
    // financeiros — soma de PercursoDia.distanciaMetros com `data` dentro
    // do mês de referência.
    prisma.percursoDia.findMany({
      where: { motoristaId, data: { gte: inicioMes, lt: fimMesExclusivo } },
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
      const vencimento = new Date(Date.UTC(mesReferencia.getUTCFullYear(), mesReferencia.getUTCMonth(), diaVencimento));
      const atrasado = m.status === "PENDENTE" && vencimento < hojeUTC;
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
    kmRodados: {
      total: kmDetalhes.reduce((acc, d) => acc + d.km, 0),
      detalhes: kmDetalhes,
    },
  };
}
