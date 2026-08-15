import { describe, expect, it } from "vitest";

import { normalizarTelefoneWhatsApp, linkWhatsApp } from "@/lib/whatsapp";

describe("normalizarTelefoneWhatsApp", () => {
  it("remove formatação e adiciona o 55 quando faltar", () => {
    expect(normalizarTelefoneWhatsApp("(11) 93204-9352")).toBe("5511932049352");
  });

  it("não duplica o 55 quando o número já vem com DDI", () => {
    expect(normalizarTelefoneWhatsApp("5511932049352")).toBe("5511932049352");
  });

  it("mantém números que só coincidentemente começam com 55 mas são curtos (sem DDI real)", () => {
    // "55" + DDD(2) + número(8 ou 9) só é DDI de verdade a partir de 12
    // dígitos — abaixo disso é tratado como número local e ganha o prefixo.
    expect(normalizarTelefoneWhatsApp("5599999")).toBe("555599999");
  });

  it("retorna string vazia para telefone vazio", () => {
    expect(normalizarTelefoneWhatsApp("")).toBe("");
  });

  it("retorna string vazia quando não há nenhum dígito", () => {
    expect(normalizarTelefoneWhatsApp("abc-def")).toBe("");
  });
});

describe("linkWhatsApp", () => {
  it("monta o link wa.me com telefone normalizado e mensagem codificada", () => {
    const link = linkWhatsApp("(11) 93204-9352", "Olá! Vim pelo site.");
    expect(link).toBe("https://wa.me/5511932049352?text=Ol%C3%A1!%20Vim%20pelo%20site.");
  });

  it("retorna null quando o telefone não tem nenhum dígito", () => {
    expect(linkWhatsApp("", "Olá!")).toBeNull();
    expect(linkWhatsApp("sem números", "Olá!")).toBeNull();
  });
});
