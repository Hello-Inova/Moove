import { describe, expect, it } from "vitest";

import { cpfValido, cpfSchema } from "@/lib/validation/cpf";

// CPFs válidos (dígito verificador correto) gerados pelo algoritmo oficial —
// não são de pessoas reais, só sequências-base + DV calculado.
const CPFS_VALIDOS = ["12345678909", "98765432100", "01234567890"];

describe("cpfValido", () => {
  it("aceita CPFs com dígito verificador correto", () => {
    for (const cpf of CPFS_VALIDOS) {
      expect(cpfValido(cpf)).toBe(true);
    }
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(cpfValido("12345678900")).toBe(false);
  });

  it("rejeita CPFs com todos os dígitos iguais mesmo que 'passem' na conta", () => {
    // 111.111.111-11, 000.000.000-00 etc. batem a fórmula do DV mas nunca
    // são CPFs reais emitidos — a Receita Federal nunca gera esses.
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
    expect(cpfValido("99999999999")).toBe(false);
  });

  it("rejeita comprimento diferente de 11 dígitos", () => {
    expect(cpfValido("123456789")).toBe(false);
    expect(cpfValido("123456789012")).toBe(false);
    expect(cpfValido("")).toBe(false);
  });

  it("ignora pontuação (máscara) antes de validar", () => {
    expect(cpfValido("123.456.789-09")).toBe(true);
  });
});

describe("cpfSchema", () => {
  it("normaliza (remove máscara) e aceita CPF válido", () => {
    const resultado = cpfSchema.safeParse("123.456.789-09");
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).toBe("12345678909");
    }
  });

  it("rejeita CPF inválido com mensagem de erro", () => {
    const resultado = cpfSchema.safeParse("111.111.111-11");
    expect(resultado.success).toBe(false);
  });

  it("rejeita valor com quantidade errada de dígitos", () => {
    const resultado = cpfSchema.safeParse("123.456.789");
    expect(resultado.success).toBe(false);
  });
});
