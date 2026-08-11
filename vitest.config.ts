import { defineConfig } from "vitest/config";
import path from "node:path";

// Config mínima — os testes deste projeto cobrem só lógica "pura" (sem
// Prisma/banco, sem Next runtime), então não precisamos do plugin do
// Next.js aqui. Só o alias "@/*" -> "src/*" (mesmo do tsconfig.json), usado
// por alguns módulos testados (ex: schemas.ts importa cpf.ts com "@/...").
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
