import { describe, expect, it } from "vitest";

import { adicionarDias } from "@/lib/date-utils";

describe("adicionarDias", () => {
  it("soma dias corretamente", () => {
    const inicio = new Date(Date.UTC(2026, 0, 1));
    const resultado = adicionarDias(inicio, 30);
    expect(resultado.getUTCFullYear()).toBe(2026);
    expect(resultado.getUTCMonth()).toBe(0);
    expect(resultado.getUTCDate()).toBe(31);
  });

  it("atravessa o fim do mês/ano corretamente", () => {
    const inicio = new Date(Date.UTC(2025, 11, 20)); // 20 dez 2025
    const resultado = adicionarDias(inicio, 30);
    expect(resultado.getUTCFullYear()).toBe(2026);
    expect(resultado.getUTCMonth()).toBe(0); // janeiro
    expect(resultado.getUTCDate()).toBe(19);
  });

  it("aceita dias negativos (subtrai)", () => {
    const inicio = new Date(Date.UTC(2026, 0, 31));
    const resultado = adicionarDias(inicio, -30);
    expect(resultado.getUTCFullYear()).toBe(2026);
    expect(resultado.getUTCMonth()).toBe(0);
    expect(resultado.getUTCDate()).toBe(1);
  });

  it("não muta a data original (usada em loop de múltiplos ciclos vencidos)", () => {
    const original = new Date(Date.UTC(2026, 0, 1));
    const copiaParaComparar = new Date(original);
    adicionarDias(original, 30);
    expect(original.getTime()).toBe(copiaParaComparar.getTime());
  });

  it("dias = 0 retorna uma data equivalente (nova instância)", () => {
    const inicio = new Date(Date.UTC(2026, 0, 1));
    const resultado = adicionarDias(inicio, 0);
    expect(resultado.getTime()).toBe(inicio.getTime());
    expect(resultado).not.toBe(inicio);
  });
});
