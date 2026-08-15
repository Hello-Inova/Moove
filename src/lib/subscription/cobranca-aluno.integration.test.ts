import { beforeEach, describe, expect, it } from "vitest";

import { prismaTest as prisma, limparBancoDeTeste } from "@/test/db";
import { criarMotorista, criarResponsavelComAluno, criarVinculo, criarAssinaturaAtiva } from "@/test/fixtures";
import { adicionarDias } from "@/lib/date-utils";
import { processarCobrancasAlunoVencidas } from "@/lib/subscription/cobranca-aluno";

// Testes de INTEGRAÇÃO — precisam de um Postgres de teste rodando (ver
// README / .env.test.example). Não mockamos `notificarPush`: como nenhum
// fixture cria PushSubscription, a função só faz um SELECT que devolve
// lista vazia e não dispara nenhuma chamada de rede de verdade (ver
// src/lib/push/notificar.ts) — então não há nada pra mockar aqui.

const AGORA = new Date(Date.UTC(2026, 0, 1));

beforeEach(async () => {
  await limparBancoDeTeste();
});

describe("processarCobrancasAlunoVencidas — faixa grátis dinâmica", () => {
  it("cobra só os vínculos além da faixa grátis, promovendo o mais antigo", async () => {
    const motorista = await criarMotorista();
    await criarAssinaturaAtiva({ motoristaId: motorista.id, alunosGratis: 1, valorPorAlunoExcedente: 2.5 });

    const { responsavel: r1, aluno: a1 } = await criarResponsavelComAluno();
    const { responsavel: r2, aluno: a2 } = await criarResponsavelComAluno();

    // V1 é o vínculo mais ANTIGO (criadoEm anterior) — deve ficar na faixa
    // grátis. V2 é mais novo — deve ser cobrado.
    const v1 = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: r1.id,
      alunoId: a1.id,
      criadoEm: adicionarDias(AGORA, -60),
      proximaCobrancaEm: AGORA,
    });
    const v2 = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: r2.id,
      alunoId: a2.id,
      criadoEm: adicionarDias(AGORA, -30),
      proximaCobrancaEm: AGORA,
    });

    const resultado = await processarCobrancasAlunoVencidas(AGORA);

    expect(resultado.vinculosAvaliados).toBe(2);
    expect(resultado.cobrancasGeradas).toBe(1);

    const cobrancas = await prisma.cobrancaAluno.findMany();
    expect(cobrancas).toHaveLength(1);
    expect(cobrancas[0].vinculoId).toBe(v2.id);
    expect(Number(cobrancas[0].valor)).toBeCloseTo(2.5, 6);
    expect(cobrancas[0].status).toBe("PENDENTE");

    // Os dois vínculos avançam o corte em +30 dias, cobrado ou não —
    // "não cobrar" (faixa grátis) não é o mesmo que "não avaliar".
    const v1Atualizado = await prisma.vinculo.findUniqueOrThrow({ where: { id: v1.id } });
    const v2Atualizado = await prisma.vinculo.findUniqueOrThrow({ where: { id: v2.id } });
    expect(v1Atualizado.proximaCobrancaEm?.getTime()).toBe(adicionarDias(AGORA, 30).getTime());
    expect(v2Atualizado.proximaCobrancaEm?.getTime()).toBe(adicionarDias(AGORA, 30).getTime());
  });

  it("não gera nenhuma cobrança quando o motorista não tem assinatura ATIVA (só reagenda)", async () => {
    const motorista = await criarMotorista();
    // Sem `criarAssinaturaAtiva` — motorista em teste grátis/sem plano.
    const { responsavel, aluno } = await criarResponsavelComAluno();
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      proximaCobrancaEm: AGORA,
    });

    const resultado = await processarCobrancasAlunoVencidas(AGORA);

    expect(resultado.cobrancasGeradas).toBe(0);
    const cobrancas = await prisma.cobrancaAluno.findMany();
    expect(cobrancas).toHaveLength(0);

    // Mesmo sem cobrar, o corte reagenda — pra não acumular cobrança
    // retroativa se o motorista assinar um plano depois.
    const vinculoAtualizado = await prisma.vinculo.findUniqueOrThrow({ where: { id: vinculo.id } });
    expect(vinculoAtualizado.proximaCobrancaEm?.getTime()).toBe(adicionarDias(AGORA, 30).getTime());
  });

  it("não avalia vínculo REVOGADO nem um vínculo cujo corte ainda não venceu", async () => {
    const motorista = await criarMotorista();
    await criarAssinaturaAtiva({ motoristaId: motorista.id, alunosGratis: 0, valorPorAlunoExcedente: 3 });

    const { responsavel: r1, aluno: a1 } = await criarResponsavelComAluno();
    const { responsavel: r2, aluno: a2 } = await criarResponsavelComAluno();

    await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: r1.id,
      alunoId: a1.id,
      status: "REVOGADO",
      proximaCobrancaEm: AGORA, // já teria vencido, mas está revogado
    });
    await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: r2.id,
      alunoId: a2.id,
      status: "ATIVO",
      proximaCobrancaEm: adicionarDias(AGORA, 5), // ainda não venceu
    });

    const resultado = await processarCobrancasAlunoVencidas(AGORA);

    expect(resultado.vinculosAvaliados).toBe(0);
    expect(resultado.cobrancasGeradas).toBe(0);
  });
});

describe("processarCobrancasAlunoVencidas — múltiplos cortes vencidos de uma vez (cron parado por um tempo)", () => {
  it("gera uma CobrancaAluno por corte de 30 dias vencido, sem repetir nem pular nenhum", async () => {
    const motorista = await criarMotorista();
    await criarAssinaturaAtiva({ motoristaId: motorista.id, alunosGratis: 0, valorPorAlunoExcedente: 4 });
    const { responsavel, aluno } = await criarResponsavelComAluno();

    // Corte original venceu há 65 dias — 3 janelas de 30 dias já caberiam
    // dentro desse atraso (0, 30 e 60 dias atrás), a próxima só vence daqui
    // a 25 dias.
    const proximaCobrancaOriginal = adicionarDias(AGORA, -65);
    const vinculo = await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      criadoEm: adicionarDias(AGORA, -200),
      proximaCobrancaEm: proximaCobrancaOriginal,
    });

    const resultado = await processarCobrancasAlunoVencidas(AGORA);

    expect(resultado.cobrancasGeradas).toBe(3);

    const cobrancas = await prisma.cobrancaAluno.findMany({
      where: { vinculoId: vinculo.id },
      orderBy: { cicloFim: "asc" },
    });
    expect(cobrancas).toHaveLength(3);
    cobrancas.forEach((c) => expect(Number(c.valor)).toBeCloseTo(4, 6));

    // Ciclos consecutivos de 30 dias, sem drift, a partir da data original.
    expect(cobrancas[0].cicloFim.getTime()).toBe(adicionarDias(proximaCobrancaOriginal, 0).getTime());
    expect(cobrancas[1].cicloFim.getTime()).toBe(adicionarDias(proximaCobrancaOriginal, 30).getTime());
    expect(cobrancas[2].cicloFim.getTime()).toBe(adicionarDias(proximaCobrancaOriginal, 60).getTime());

    const vinculoAtualizado = await prisma.vinculo.findUniqueOrThrow({ where: { id: vinculo.id } });
    expect(vinculoAtualizado.proximaCobrancaEm?.getTime()).toBe(adicionarDias(proximaCobrancaOriginal, 90).getTime());
  });

  it("é idempotente: rodar duas vezes seguidas pro mesmo instante não duplica cobrança", async () => {
    const motorista = await criarMotorista();
    await criarAssinaturaAtiva({ motoristaId: motorista.id, alunosGratis: 0, valorPorAlunoExcedente: 4 });
    const { responsavel, aluno } = await criarResponsavelComAluno();
    await criarVinculo({
      motoristaId: motorista.id,
      responsavelId: responsavel.id,
      alunoId: aluno.id,
      proximaCobrancaEm: AGORA,
    });

    const primeira = await processarCobrancasAlunoVencidas(AGORA);
    expect(primeira.cobrancasGeradas).toBe(1);

    // Rodar de novo pro MESMO `agora`: o vínculo já teve seu
    // `proximaCobrancaEm` avançado pra 30 dias no futuro, então não deve
    // mais aparecer como vencido — nada novo é gerado.
    const segunda = await processarCobrancasAlunoVencidas(AGORA);
    expect(segunda.vinculosAvaliados).toBe(0);
    expect(segunda.cobrancasGeradas).toBe(0);

    const cobrancas = await prisma.cobrancaAluno.findMany();
    expect(cobrancas).toHaveLength(1);
  });
});
