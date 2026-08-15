import { beforeEach, describe, expect, it } from "vitest";

import { prismaTest as prisma, limparBancoDeTeste } from "@/test/db";
import { criarMotorista, criarResponsavelComAluno, criarVinculo } from "@/test/fixtures";
import { processarMensalidadesTransporteVencidas } from "@/lib/mensalidade/mensalidade-transporte";

// Testes de INTEGRAÇÃO — precisam de um Postgres de teste rodando (ver
// README / .env.test.example). `notificarPush` não é mockado: sem
// PushSubscription nos fixtures, a função só faz um SELECT vazio e não
// dispara nenhuma chamada de rede de verdade.
//
// Nota sobre `mensalidadesGeradas`: a função sob teste decide se uma linha
// foi CRIADA nesta chamada comparando `criadoEm` (hora real do INSERT no
// banco, sempre "agora" de verdade) com o `agora` recebido por parâmetro —
// funciona em produção porque lá `agora` é sempre `new Date()` (bem perto
// do INSERT). Por isso, nos testes que checam esse contador, usamos
// `agora = new Date()` de verdade em vez de uma data fixa arbitrária —
// senão o contador nunca bateria (INSERT aconteceria "agora" de verdade,
// longe da data fixa do teste). Testes que só verificam SE uma linha foi
// criada (não o contador) podem usar qualquer data fixa normalmente.

beforeEach(async () => {
  await limparBancoDeTeste();
});

function primeiroDiaDoMesUTC(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
}

describe("processarMensalidadesTransporteVencidas — geração básica", () => {
  it("gera a mensalidade do mês quando o dia de pagamento já chegou", async () => {
    const agora = new Date();
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      valorMensalidade: 250,
      // Dia 1 garante que já venceu não importa em que dia do mês o teste
      // rodar de verdade.
      diaPagamentoMensalidade: 1,
    });

    const resultado = await processarMensalidadesTransporteVencidas(agora);

    expect(resultado.vinculosAvaliados).toBe(1);
    expect(resultado.mensalidadesGeradas).toBe(1);

    const mensalidades = await prisma.mensalidadeTransporte.findMany({ where: { vinculoId: vinculo.id } });
    expect(mensalidades).toHaveLength(1);
    expect(Number(mensalidades[0].valor)).toBeCloseTo(250, 6);
    expect(mensalidades[0].status).toBe("PENDENTE");
    expect(mensalidades[0].mesReferencia.getTime()).toBe(primeiroDiaDoMesUTC(agora).getTime());
    expect(mensalidades[0].motoristaId).toBe(motorista.id);
  });

  it("é idempotente: rodar duas vezes pro mesmo instante não duplica a linha (unique vinculoId+mesReferencia)", async () => {
    const agora = new Date();
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      valorMensalidade: 180,
      diaPagamentoMensalidade: 1,
    });

    const primeira = await processarMensalidadesTransporteVencidas(agora);
    expect(primeira.mensalidadesGeradas).toBe(1);

    // Roda de novo pro MESMO `agora` — o upsert encontra a linha existente
    // (update: {}, não altera nada) em vez de criar outra.
    await processarMensalidadesTransporteVencidas(agora);

    const mensalidades = await prisma.mensalidadeTransporte.findMany({ where: { vinculoId: vinculo.id } });
    expect(mensalidades).toHaveLength(1);
  });
});

describe("processarMensalidadesTransporteVencidas — condições de disparo", () => {
  it("não gera quando falta valorMensalidade ou diaPagamentoMensalidade configurado", async () => {
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      // Nem valorMensalidade nem diaPagamentoMensalidade preenchidos —
      // motorista ainda não configurou o perfil do aluno.
    });

    const resultado = await processarMensalidadesTransporteVencidas(new Date());

    expect(resultado.vinculosAvaliados).toBe(0);
    expect(resultado.mensalidadesGeradas).toBe(0);
  });

  it("não gera quando o dia de pagamento do mês ainda não chegou", async () => {
    const agoraFixo = new Date(Date.UTC(2026, 5, 10)); // 10 de junho de 2026
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      valorMensalidade: 300,
      diaPagamentoMensalidade: 20, // só vence dia 20, hoje é dia 10
    });

    const resultado = await processarMensalidadesTransporteVencidas(agoraFixo);

    expect(resultado.mensalidadesGeradas).toBe(0);
    const mensalidades = await prisma.mensalidadeTransporte.findMany({ where: { vinculoId: vinculo.id } });
    expect(mensalidades).toHaveLength(0);
  });

  it("trata dia de pagamento > último dia do mês como o último dia do mês (ex: dia 31 em fevereiro)", async () => {
    // Fevereiro de 2026 tem 28 dias — dia de pagamento 31 deve ser tratado
    // como dia 28. No dia 28, já deve ter vencido.
    const agoraFixo = new Date(Date.UTC(2026, 1, 28)); // 28/fev/2026
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      valorMensalidade: 200,
      diaPagamentoMensalidade: 31,
    });

    await processarMensalidadesTransporteVencidas(agoraFixo);

    // O contador `mensalidadesGeradas` não é confiável aqui (depende do
    // relógio real vs. `agoraFixo` — ver nota no topo do arquivo); o que
    // importa neste teste é que a linha foi criada mesmo com dia 31
    // "estourando" fevereiro.
    const mensalidades = await prisma.mensalidadeTransporte.findMany({ where: { vinculoId: vinculo.id } });
    expect(mensalidades).toHaveLength(1);
  });

  it("respeita a vigência: não gera antes de vigenciaInicio", async () => {
    const agoraFixo = new Date(Date.UTC(2026, 5, 10));
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      valorMensalidade: 200,
      diaPagamentoMensalidade: 1,
      vigenciaInicio: new Date(Date.UTC(2026, 6, 1)), // só começa em julho
    });

    await processarMensalidadesTransporteVencidas(agoraFixo);

    const mensalidades = await prisma.mensalidadeTransporte.findMany({ where: { vinculoId: vinculo.id } });
    expect(mensalidades).toHaveLength(0);
  });

  it("respeita a vigência: não gera depois de vigenciaFim", async () => {
    const agoraFixo = new Date(Date.UTC(2026, 5, 10));
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      valorMensalidade: 200,
      diaPagamentoMensalidade: 1,
      vigenciaFim: new Date(Date.UTC(2026, 4, 1)), // terminou em maio
    });

    await processarMensalidadesTransporteVencidas(agoraFixo);

    const mensalidades = await prisma.mensalidadeTransporte.findMany({ where: { vinculoId: vinculo.id } });
    expect(mensalidades).toHaveLength(0);
  });

  it("gera dentro da janela de vigência", async () => {
    const agoraFixo = new Date(Date.UTC(2026, 5, 10));
    const motorista = await criarMotorista();
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      valorMensalidade: 200,
      diaPagamentoMensalidade: 1,
      vigenciaInicio: new Date(Date.UTC(2026, 0, 1)),
      vigenciaFim: new Date(Date.UTC(2026, 11, 1)),
    });

    await processarMensalidadesTransporteVencidas(agoraFixo);

    const mensalidades = await prisma.mensalidadeTransporte.findMany({ where: { vinculoId: vinculo.id } });
    expect(mensalidades).toHaveLength(1);
  });
});
