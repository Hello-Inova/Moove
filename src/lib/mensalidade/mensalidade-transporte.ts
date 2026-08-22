import "server-only";

import { prisma } from "@/lib/prisma";
import { notificarPush } from "@/lib/push/notificar";
import { formatarBRL } from "@/lib/subscription/plans";
import { sendCobrancaMensalidadeEmail, EmailSendError } from "@/lib/email/mailer";

function diasNoMes(ano: number, mesIndiceZero: number): number {
  return new Date(ano, mesIndiceZero + 1, 0).getDate();
}

function primeiroDiaDoMes(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

/**
 * Motor de mensalidade do TRANSPORTE — dinheiro combinado direto entre
 * motorista e responsável (nada disso passa pela Asaas; não confundir com
 * `processarCobrancasAlunoVencidas`, que é a taxa da plataforma). Chamado
 * pelo cron diário (ver /api/cron/mensalidades e vercel.json).
 *
 * Regras:
 * - Só considera vínculo ATIVO com `valorMensalidade` e
 *   `diaPagamentoMensalidade` preenchidos (o motorista configura isso na
 *   tela de perfil do aluno — enquanto não configurar, nenhuma mensalidade
 *   é gerada).
 * - Respeita a vigência: não gera antes de `vigenciaInicio` nem depois de
 *   `vigenciaFim` (quando definido).
 * - Só gera a mensalidade do mês corrente quando o dia de hoje já alcançou
 *   `diaPagamentoMensalidade` (dia >31 em meses menores é tratado como o
 *   último dia do mês).
 * - Idempotente: `@@unique([vinculoId, mesReferencia])` garante que rodar o
 *   cron mais de uma vez no mesmo dia (ou mês) nunca duplica.
 *
 * Fase 4 do plano de implantação (fluxograma "Contrato, Cadastro e
 * Conexão"): toda mensalidade nova gerada aqui já dispara automaticamente o
 * lembrete de cobrança por PIX pro responsável (push + e-mail, com a chave
 * PIX do motorista) — antes disso, o motorista precisava lembrar de clicar
 * em "Cobrar" manualmente (ver PainelDashboard.tsx). O dinheiro continua
 * indo direto pro motorista; a plataforma só automatiza o aviso.
 */
export async function processarMensalidadesTransporteVencidas(
  agora: Date = new Date()
): Promise<{ vinculosAvaliados: number; mensalidadesGeradas: number }> {
  const mesReferenciaAtual = primeiroDiaDoMes(agora);
  const diaHoje = agora.getDate();

  const vinculos = await prisma.vinculo.findMany({
    where: {
      status: "ATIVO",
      valorMensalidade: { not: null },
      diaPagamentoMensalidade: { not: null },
    },
    select: {
      id: true,
      motoristaId: true,
      responsavelId: true,
      valorMensalidade: true,
      diaPagamentoMensalidade: true,
      vigenciaInicio: true,
      vigenciaFim: true,
      aluno: { select: { nome: true } },
      motorista: { select: { nome: true, chavePix: true } },
      responsavel: { select: { nome: true, email: true } },
    },
  });

  let mensalidadesGeradas = 0;
  const geradasPorMotorista = new Map<string, { qtd: number; total: number }>();

  for (const vinculo of vinculos) {
    if (!vinculo.valorMensalidade || !vinculo.diaPagamentoMensalidade) continue;

    if (vinculo.vigenciaInicio && mesReferenciaAtual < vinculo.vigenciaInicio) continue;
    if (vinculo.vigenciaFim && mesReferenciaAtual > vinculo.vigenciaFim) continue;

    const ultimoDiaDoMes = diasNoMes(agora.getFullYear(), agora.getMonth());
    const diaDeCorte = Math.min(vinculo.diaPagamentoMensalidade, ultimoDiaDoMes);
    if (diaHoje < diaDeCorte) continue;

    const resultado = await prisma.mensalidadeTransporte.upsert({
      where: { vinculoId_mesReferencia: { vinculoId: vinculo.id, mesReferencia: mesReferenciaAtual } },
      update: {},
      create: {
        vinculoId: vinculo.id,
        motoristaId: vinculo.motoristaId,
        mesReferencia: mesReferenciaAtual,
        valor: vinculo.valorMensalidade,
        status: "PENDENTE",
      },
    });

    // upsert não diz se criou ou só encontrou — comparamos criadoEm com
    // "agora" (poucos ms de diferença) pra saber se foi criação nova nesta
    // rodada, só pra decidir se soma no resumo do push e se dispara o
    // lembrete pro responsável (não reenviar em rodadas seguintes do
    // mesmo mês).
    if (Math.abs(resultado.criadoEm.getTime() - agora.getTime()) < 60_000) {
      mensalidadesGeradas++;
      const acumulado = geradasPorMotorista.get(vinculo.motoristaId) ?? { qtd: 0, total: 0 };
      acumulado.qtd++;
      acumulado.total += Number(vinculo.valorMensalidade);
      geradasPorMotorista.set(vinculo.motoristaId, acumulado);

      await lembrarResponsavelPix({
        responsavelId: vinculo.responsavelId,
        responsavelNome: vinculo.responsavel.nome,
        responsavelEmail: vinculo.responsavel.email,
        motoristaNome: vinculo.motorista.nome,
        motoristaChavePix: vinculo.motorista.chavePix,
        alunoNome: vinculo.aluno.nome,
        valor: Number(vinculo.valorMensalidade),
        vencimento: mesReferenciaAtual,
        diaPagamento: vinculo.diaPagamentoMensalidade,
      });
    }
  }

  for (const [motoristaId, { qtd, total }] of geradasPorMotorista) {
    await notificarPush(
      { motoristaId },
      {
        title: "Mensalidades do transporte geradas",
        body:
          qtd === 1
            ? `1 mensalidade de ${formatarBRL(total)} pronta — veja no perfil do aluno.`
            : `${qtd} mensalidades (total ${formatarBRL(total)}) prontas — veja no perfil de cada aluno.`,
        tag: `mensalidades-transporte-${motoristaId}-${agora.toISOString().slice(0, 10)}`,
      }
    );
  }

  return { vinculosAvaliados: vinculos.length, mensalidadesGeradas };
}

/**
 * Avisa o responsável (push + e-mail) que a mensalidade do mês foi gerada,
 * já com a chave PIX do motorista — automação do lembrete que antes
 * dependia do motorista clicar em "Cobrar" manualmente. Falha de envio
 * (push sem inscrição, e-mail fora do ar) nunca impede a
 * `MensalidadeTransporte` de existir — é só aviso, best-effort.
 */
async function lembrarResponsavelPix(params: {
  responsavelId: string;
  responsavelNome: string;
  responsavelEmail: string;
  motoristaNome: string;
  motoristaChavePix: string | null;
  alunoNome: string;
  valor: number;
  vencimento: Date;
  diaPagamento: number;
}): Promise<void> {
  const { responsavelId, responsavelNome, responsavelEmail, motoristaNome, motoristaChavePix, alunoNome, valor, vencimento, diaPagamento } =
    params;

  await notificarPush(
    { responsavelId },
    {
      title: "Mensalidade do transporte disponível",
      body: motoristaChavePix
        ? `${formatarBRL(valor)} — vence dia ${diaPagamento}. Pague via PIX: ${motoristaChavePix}`
        : `${formatarBRL(valor)} — vence dia ${diaPagamento}. Combine o pagamento com ${motoristaNome}.`,
      tag: `mensalidade-lembrete-${responsavelId}-${vencimento.toISOString().slice(0, 7)}`,
    }
  );

  try {
    await sendCobrancaMensalidadeEmail({
      to: responsavelEmail,
      nomeResponsavel: responsavelNome,
      nomeAluno: alunoNome,
      nomeMotorista: motoristaNome,
      valor,
      diaPagamento,
      chavePix: motoristaChavePix,
    });
  } catch (err) {
    if (!(err instanceof EmailSendError)) throw err;
    console.error(`[mensalidade] falha ao enviar e-mail de lembrete pra ${responsavelEmail}`, err);
  }
}

/**
 * Ressincroniza as `MensalidadeTransporte` de um vínculo depois que o
 * motorista edita a vigência (início/fim) ou os termos de pagamento na tela
 * de perfil do aluno (ver PATCH /api/motorista/vinculos/[id]/perfil) — sem
 * isso, o Painel só refletiria a mudança pra frente (próximo corte do cron),
 * nunca pros meses já passados que passaram a entrar na vigência (item 13
 * do pedido do motorista).
 *
 * - Gera (upsert, idempotente) a mensalidade de cada mês entre o início da
 *   vigência (ou a criação do vínculo, se não houver início definido) e o
 *   mês corrente — incluindo meses passados, que naturalmente aparecem
 *   "atrasados" no Painel pela comparação de vencimento normal.
 * - Cancela (`CANCELADO`) mensalidades `PENDENTE` que ficaram fora da nova
 *   janela de vigência (antes do novo início ou depois do novo fim) — não
 *   mexe em nada que já foi pago.
 */
export async function sincronizarMensalidadesVigencia(vinculoId: string, agora: Date = new Date()): Promise<void> {
  const vinculo = await prisma.vinculo.findUnique({
    where: { id: vinculoId },
    select: {
      id: true,
      motoristaId: true,
      status: true,
      criadoEm: true,
      valorMensalidade: true,
      diaPagamentoMensalidade: true,
      vigenciaInicio: true,
      vigenciaFim: true,
    },
  });
  if (!vinculo || vinculo.status !== "ATIVO") return;
  if (!vinculo.valorMensalidade || !vinculo.diaPagamentoMensalidade) return;

  const mesReferenciaAtual = primeiroDiaDoMes(agora);
  const diaHoje = agora.getDate();
  const ultimoDiaDoMesAtual = diasNoMes(agora.getFullYear(), agora.getMonth());
  const diaDeCorteAtual = Math.min(vinculo.diaPagamentoMensalidade, ultimoDiaDoMesAtual);
  const geraMesAtual = diaHoje >= diaDeCorteAtual;

  const inicioJanela = vinculo.vigenciaInicio ?? primeiroDiaDoMes(vinculo.criadoEm);
  const fimJanela = vinculo.vigenciaFim && vinculo.vigenciaFim < mesReferenciaAtual ? vinculo.vigenciaFim : mesReferenciaAtual;

  // Gera (upsert) cada mês da janela até o mês corrente (ou o fim da
  // vigência, se já passou) — meses passados entram direto como
  // "atrasados" no Painel pela regra normal de vencimento.
  let cursor = new Date(inicioJanela);
  while (cursor <= fimJanela) {
    const éMesAtual = cursor.getTime() === mesReferenciaAtual.getTime();
    if (!éMesAtual || geraMesAtual) {
      await prisma.mensalidadeTransporte.upsert({
        where: { vinculoId_mesReferencia: { vinculoId: vinculo.id, mesReferencia: cursor } },
        update: {},
        create: {
          vinculoId: vinculo.id,
          motoristaId: vinculo.motoristaId,
          mesReferencia: cursor,
          valor: vinculo.valorMensalidade,
          status: "PENDENTE",
        },
      });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  // Cancela mensalidades pendentes que ficaram fora da vigência atual —
  // antes do novo início ou depois do novo fim (quando definido).
  await prisma.mensalidadeTransporte.updateMany({
    where: {
      vinculoId: vinculo.id,
      status: "PENDENTE",
      OR: [
        { mesReferencia: { lt: inicioJanela } },
        ...(vinculo.vigenciaFim ? [{ mesReferencia: { gt: vinculo.vigenciaFim } }] : []),
      ],
    },
    data: { status: "CANCELADO" },
  });
}
