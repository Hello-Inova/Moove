import { defineConfig } from "vitest/config";
import path from "node:path";

// Config dos testes UNITÁRIOS — cobrem só lógica "pura" (sem Prisma/banco,
// sem Next runtime), então não precisamos do plugin do Next.js aqui. Testes
// de INTEGRAÇÃO (que sobem um Postgres de verdade) ficam em
// `*.integration.test.ts` e usam `vitest.integration.config.ts` — por isso
// esse padrão é explicitamente excluído aqui (evita rodar teste que precisa
// de banco no `npm test` padrão, que deve continuar rápido e sem infra).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // O pacote real `server-only` decide se lança erro com base numa
      // condição de resolução específica do bundler do Next.js (webpack) —
      // fora do Next (aqui, via Vite/Vitest) ele sempre lança "This module
      // cannot be imported from a Client Component module", mesmo em teste
      // puro de Node. O stub deixa o import passar direto, sem efeito.
      "server-only": path.resolve(__dirname, "./test-stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.integration.test.ts"],
    // Servidores de produção (Vercel) rodam em UTC; fixamos aqui pra os
    // testes de data (ex: adicionarDias, ciclos de 30 dias) darem o mesmo
    // resultado independente do fuso da máquina/CI que roda o teste.
    env: {
      TZ: "UTC",
    },
  },
});
