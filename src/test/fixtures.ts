import type { Prisma } from "@prisma/client";

import { prismaTest } from "@/test/db";

// Helpers de fixture pros testes de integração — só o mínimo de campos
// obrigatórios do schema, com defaults sensatos sobrescrevíveis via
// `overrides`. Objetivo é deixar cada teste de integração legível (poucas
// linhas de setup, foco no cenário) em vez de repetir o grafo inteiro de
// relações (Responsavel -> Aluno -> Convite -> Vinculo) em todo teste.

let contador = 0;
/** Sufixo curto e crescente pra gerar e-mails/códigos únicos sem
 * dependência externa (uuid) — suficiente porque cada teste roda com o
 * banco limpo (ver `limparBancoDeTeste`), não precisa ser globalmente
 * único entre execuções, só dentro da mesma. */
function proximoSufixo(): string {
  contador += 1;
  return `${Date.now()}_${contador}`;
}

const AGORA_FIXO = new Date(Date.UTC(2026, 0, 1));
function testeExpiraEmPadrao(): Date {
  const d = new Date(AGORA_FIXO);
  d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

export async function criarMotorista(overrides: Partial<Prisma.MotoristaUncheckedCreateInput> = {}) {
  const sufixo = proximoSufixo();
  return prismaTest.motorista.create({
    data: {
      nome: "Motorista Teste",
      email: `motorista_${sufixo}@teste.com`,
      telefone: "11999990000",
      senhaHash: "hash_fake",
      consentimentoLgpdAceitoEm: AGORA_FIXO,
      testeExpiraEm: testeExpiraEmPadrao(),
      ...overrides,
    },
  });
}

export async function criarResponsavelComAluno(
  overrides: {
    responsavel?: Partial<Prisma.ResponsavelUncheckedCreateInput>;
    aluno?: Partial<Prisma.AlunoUncheckedCreateInput>;
  } = {}
) {
  const sufixo = proximoSufixo();
  const responsavel = await prismaTest.responsavel.create({
    data: {
      nome: "Responsável Teste",
      email: `responsavel_${sufixo}@teste.com`,
      telefone: "11988880000",
      senhaHash: "hash_fake",
      consentimentoLgpdAceitoEm: AGORA_FIXO,
      testeExpiraEm: testeExpiraEmPadrao(),
      ...overrides.responsavel,
    },
  });

  const aluno = await prismaTest.aluno.create({
    data: {
      responsavelId: responsavel.id,
      nome: "Aluno Teste",
      ...overrides.aluno,
    },
  });

  return { responsavel, aluno };
}

/** Cria Convite + Vinculo num só passo — todo Vinculo exige um Convite
 * próprio (`conviteId String @unique`), então isso sempre anda junto. */
export async function criarVinculo(params: {
  motoristaId: string;
  responsavelId: string;
  alunoId: string;
  status?: "ATIVO" | "REVOGADO";
  criadoEm?: Date;
  proximaCobrancaEm?: Date | null;
  valorMensalidade?: number | null;
  diaPagamentoMensalidade?: number | null;
  vigenciaInicio?: Date | null;
  vigenciaFim?: Date | null;
}) {
  const sufixo = proximoSufixo();
  const convite = await prismaTest.convite.create({
    data: {
      codigo: `CONV${sufixo}`,
      motoristaId: params.motoristaId,
      status: "USADO",
      expiraEm: testeExpiraEmPadrao(),
      usadoPorResponsavelId: params.responsavelId,
      usadoEm: AGORA_FIXO,
    },
  });

  const vinculo = await prismaTest.vinculo.create({
    data: {
      motoristaId: params.motoristaId,
      responsavelId: params.responsavelId,
      alunoId: params.alunoId,
      conviteId: convite.id,
      status: params.status ?? "ATIVO",
      criadoEm: params.criadoEm ?? AGORA_FIXO,
      proximaCobrancaEm: params.proximaCobrancaEm ?? null,
      valorMensalidade: params.valorMensalidade ?? null,
      diaPagamentoMensalidade: params.diaPagamentoMensalidade ?? null,
      vigenciaInicio: params.vigenciaInicio ?? null,
      vigenciaFim: params.vigenciaFim ?? null,
    },
  });

  return vinculo;
}

export async function criarAssinaturaAtiva(overrides: {
  motoristaId: string;
  alunosGratis?: number;
  valorPorAlunoExcedente?: number;
}) {
  return prismaTest.assinatura.create({
    data: {
      motoristaId: overrides.motoristaId,
      tipoPlano: "PRO_TESTE",
      planoLabel: "Pró (teste)",
      cicloCobranca: "SEMESTRAL",
      qtdAlunosContratados: 1,
      valorPlano: 178.2,
      valorAlunosExcedentes: 0,
      valorTotal: 178.2,
      alunosGratis: overrides.alunosGratis ?? 0,
      valorPorAlunoExcedente: overrides.valorPorAlunoExcedente ?? 1,
      status: "ATIVA",
      testeExpiraEm: testeExpiraEmPadrao(),
      inicioEm: AGORA_FIXO,
    },
  });
}
