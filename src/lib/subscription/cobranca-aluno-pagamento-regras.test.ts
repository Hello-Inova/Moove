import { describe, expect, it } from "vitest";

import {
  VALOR_MINIMO_ASAAS,
  SemCobrancaPendenteError,
  ValorAbaixoDoMinimoError,
  somarPendentes,
  atingiuMinimoAsaas,
} from "@/lib/subscription/cobranca-aluno-pagamento-regras";

describe("somarPendentes", () => {
  it("soma o valor de várias cobranças", () => {
    expect(somarPendentes([{ valor: 1.2 }, { valor: 1.2 }, { valor: 2.6 }])).toBeCloseTo(5, 6);
  });

  it("retorna 0 pra lista vazia", () => {
    expect(somarPendentes([])).toBe(0);
  });

  it("converte valores vindos como string (padrão do Prisma Decimal serializado)", () => {
    expect(somarPendentes([{ valor: "1.20" }, { valor: "3.80" }])).toBeCloseTo(5, 6);
  });

  it("converte valores vindos como objeto Decimal (toString)", () => {
    const decimalFake = { toString: () => "2.50" };
    expect(somarPendentes([{ valor: decimalFake }, { valor: 2.5 }])).toBeCloseTo(5, 6);
  });
});

describe("atingiuMinimoAsaas", () => {
  it("é falso abaixo do mínimo", () => {
    expect(atingiuMinimoAsaas(4.99)).toBe(false);
  });

  it("é verdadeiro exatamente no mínimo (inclusivo)", () => {
    expect(atingiuMinimoAsaas(VALOR_MINIMO_ASAAS)).toBe(true);
  });

  it("é verdadeiro acima do mínimo", () => {
    expect(atingiuMinimoAsaas(10)).toBe(true);
  });

  it("aceita um mínimo customizado", () => {
    expect(atingiuMinimoAsaas(8, 10)).toBe(false);
    expect(atingiuMinimoAsaas(10, 10)).toBe(true);
  });
});

describe("ValorAbaixoDoMinimoError", () => {
  it("formata a mensagem em reais com o total pendente e o mínimo", () => {
    const err = new ValorAbaixoDoMinimoError(1.2);
    expect(err.message).toContain("R$ 1.20");
    expect(err.message).toContain("R$ 5.00");
    expect(err.totalPendente).toBe(1.2);
    expect(err.minimo).toBe(VALOR_MINIMO_ASAAS);
  });

  it("aceita um mínimo customizado explicitamente", () => {
    const err = new ValorAbaixoDoMinimoError(3, 10);
    expect(err.minimo).toBe(10);
    expect(err.message).toContain("R$ 10.00");
  });

  it("é uma instância de Error (compatível com catch genérico)", () => {
    expect(new ValorAbaixoDoMinimoError(1)).toBeInstanceOf(Error);
  });
});

describe("SemCobrancaPendenteError", () => {
  it("carrega a mensagem passada e é instância de Error", () => {
    const err = new SemCobrancaPendenteError("Não há cobrança pendente pra pagar.");
    expect(err.message).toBe("Não há cobrança pendente pra pagar.");
    expect(err).toBeInstanceOf(Error);
  });
});
