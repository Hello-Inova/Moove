import { describe, expect, it } from "vitest";

import { sanitizarDescricaoAsaas } from "@/lib/payment/asaas";

describe("sanitizarDescricaoAsaas", () => {
  it("remove emojis e símbolos rejeitados sem alterar o nome exibido do plano", () => {
    expect(sanitizarDescricaoAsaas("Moove — Plano Semestral Pró 🔥 (10% de economia)")).toBe(
      "Moove Plano Semestral Pró (10 de economia)"
    );
  });

  it("preserva letras acentuadas e pontuação simples aceita pela descrição", () => {
    expect(sanitizarDescricaoAsaas("Cobrança: Plano Pró (mensal) + 1 ano")).toBe(
      "Cobrança: Plano Pró (mensal) + 1 ano"
    );
  });

  it("limita a descrição a 500 caracteres", () => {
    expect(sanitizarDescricaoAsaas("a".repeat(600))).toHaveLength(500);
  });

  it("usa um texto seguro quando só há caracteres rejeitados", () => {
    expect(sanitizarDescricaoAsaas("🔥⭐")).toBe("Cobranca Moove");
  });
});
