import { defineConfig } from "vitest/config";
import path from "node:path";

// Config dos testes de INTEGRAÇÃO — batem num Postgres de teste de verdade
// via Prisma (ver src/test/db.ts). Separado do vitest.config.ts (testes
// unitários) porque: (1) precisa de infra externa (banco) que não deve
// rodar no `npm test` padrão/rápido; (2) timeout maior (I/O de banco real);
// (3) roda sequencial por padrão pra evitar duas suítes truncando tabelas
// ao mesmo tempo (ver comentário em `fileParallelism` abaixo).
//
// Pré-requisitos (ver README e .env.test.example):
//   docker compose -f docker-compose.test.yml up -d
//   cp .env.test.example .env.test
//   npm run test:integration:migrate   # aplica as migrations no banco de teste
//   npm run test:integration           # já carrega .env.test via dotenv-cli
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./test-stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Vários arquivos de teste truncando as mesmas tabelas ao mesmo tempo
    // (paralelismo entre ARQUIVOS, não entre os `it()` de um mesmo arquivo)
    // causaria testes se atropelando — mantém simples: um arquivo de
    // integração por vez. A suíte é pequena o suficiente pra isso não doer.
    fileParallelism: false,
    env: {
      TZ: "UTC",
    },
  },
});
