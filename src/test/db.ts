import { prisma } from "@/lib/prisma";

// Os testes de integração reaproveitam o MESMO cliente Prisma que a
// aplicação usa (`@/lib/prisma`) — de propósito: as funções testadas (ex.:
// `processarCobrancasAlunoVencidas`, `processarMensalidadesTransporteVencidas`)
// importam `prisma` desse módulo internamente, então se o teste criasse os
// fixtures por uma conexão separada, a função sob teste (que abre a PRÓPRIA
// conexão via `@/lib/prisma`) nunca enxergaria esses dados — cada uma
// falaria com um banco diferente. Em vez disso, é `DATABASE_URL` que muda:
// `npm run test:integration` carrega `.env.test` (via dotenv-cli), que
// aponta `DATABASE_URL` pro Postgres de teste (docker-compose.test.yml) —
// tanto os fixtures quanto o código de produção acabam usando essa mesma
// URL nessa execução.
//
// Segurança: recusa rodar se `DATABASE_URL` não parecer claramente um
// banco de teste. Os testes truncam tabelas inteiras entre cada `it()` (ver
// `limparBancoDeTeste`) — sem essa trava, um `.env.test` mal configurado
// (ou ausente, caindo pro `.env` de dev) apagaria dado de verdade.
const databaseUrl = process.env.DATABASE_URL ?? "";
if (!/test/i.test(databaseUrl)) {
  throw new Error(
    "DATABASE_URL não parece apontar pra um banco de TESTE (precisa conter " +
      '"test" no nome do banco/host). Rode com `npm run test:integration` ' +
      "(carrega .env.test via dotenv-cli — ver .env.test.example) em vez de " +
      "chamar o vitest direto, ou configure TEST_DATABASE_URL corretamente."
  );
}

export { prisma as prismaTest };

// Ordem importa: filhos antes dos pais (FKs). `TRUNCATE ... CASCADE` seria
// mais simples, mas prefiro a lista explícita — se alguém adicionar uma
// tabela nova e esquecer de listar aqui, o teste falha ruidosamente (dado
// sobrando entre testes) em vez de mascarar o esquecimento.
const TABELAS_EM_ORDEM_DE_LIMPEZA = [
  "alertas_proximidade",
  "embarques_dia",
  "contratos_transporte",
  "mensalidades_transporte",
  "cobrancas_aluno",
  "pagamentos",
  "assinaturas",
  "push_subscriptions",
  "percurso_pontos",
  "percursos_dia",
  "localizacoes",
  "vinculos",
  "convites",
  "alunos",
  "escolas",
  "veiculos",
  "responsaveis",
  "motoristas",
] as const;

/** Limpa todas as tabelas de negócio entre testes — chamar em `beforeEach`
 * (nunca em `beforeAll`: cada teste precisa começar de um banco vazio, não
 * só a suíte inteira). Não mexe em tabelas de infraestrutura (ex: cache de
 * geocodificação, uso de API externa, planos do admin) que não são o alvo
 * destes testes e são caras/lentas de recriar. */
export async function limparBancoDeTeste(): Promise<void> {
  for (const tabela of TABELAS_EM_ORDEM_DE_LIMPEZA) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${tabela}"`);
  }
}

export async function desconectarBancoDeTeste(): Promise<void> {
  await prisma.$disconnect();
}
