import { describe, expect, it } from "vitest";
import { z } from "zod";

import { jsonError, jsonValidationError, jsonRateLimited } from "@/lib/http";

describe("jsonError", () => {
  it("monta uma Response JSON com o status e a mensagem informados", async () => {
    const response = jsonError(404, "Aluno não encontrado.");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Aluno não encontrado." });
  });

  it("mescla campos extras no corpo", async () => {
    const response = jsonError(409, "Conflito.", { codigo: "DUPLICADO" });
    const body = await response.json();
    expect(body).toEqual({ error: "Conflito.", codigo: "DUPLICADO" });
  });
});

describe("jsonValidationError", () => {
  it("retorna 400 com os issues por campo agrupados pelo zod", async () => {
    const schema = z.object({ nome: z.string().min(2), idade: z.number().min(0) });
    const resultado = schema.safeParse({ nome: "A", idade: -1 });
    if (resultado.success) throw new Error("esperava falha de validação");

    const response = jsonValidationError(resultado.error);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Dados inválidos.");
    expect(body.issues.nome).toBeTruthy();
    expect(body.issues.idade).toBeTruthy();
  });
});

describe("jsonRateLimited", () => {
  it("retorna 429 com header Retry-After e mensagem padrão em minutos arredondados pra cima", async () => {
    const response = jsonRateLimited(90); // 1.5min -> arredonda pra 2
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
    const body = await response.json();
    expect(body.error).toContain("2 min");
  });

  it("aceita mensagem customizada", async () => {
    const response = jsonRateLimited(30, "Calma lá.");
    const body = await response.json();
    expect(body.error).toBe("Calma lá.");
  });
});
