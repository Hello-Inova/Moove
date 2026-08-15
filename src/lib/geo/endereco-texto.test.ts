import { describe, expect, it } from "vitest";

import { montarEnderecoTexto } from "@/lib/geo/endereco-texto";

describe("montarEnderecoTexto", () => {
  it("monta as duas linhas quando todos os campos estão presentes", () => {
    const texto = montarEnderecoTexto({
      logradouro: "Avenida Resedá",
      numero: "123",
      bairro: "Portais",
      cidade: "Cajamar",
      estado: "SP",
    });
    expect(texto).toBe("Avenida Resedá, 123 — Portais, Cajamar, SP");
  });

  it("omite o número quando ausente, sem deixar vírgula solta", () => {
    const texto = montarEnderecoTexto({
      logradouro: "Avenida Resedá",
      numero: null,
      bairro: "Portais",
      cidade: "Cajamar",
      estado: "SP",
    });
    expect(texto).toBe("Avenida Resedá — Portais, Cajamar, SP");
  });

  it("omite a linha 1 inteira quando não há logradouro", () => {
    const texto = montarEnderecoTexto({
      bairro: "Portais",
      cidade: "Cajamar",
      estado: "SP",
    });
    expect(texto).toBe("Portais, Cajamar, SP");
  });

  it("omite a linha 2 inteira quando bairro/cidade/estado estão ausentes", () => {
    const texto = montarEnderecoTexto({ logradouro: "Avenida Resedá", numero: "123" });
    expect(texto).toBe("Avenida Resedá, 123");
  });

  it("retorna string vazia quando nenhum campo está preenchido", () => {
    expect(montarEnderecoTexto({})).toBe("");
  });

  it("ignora campos undefined e null da mesma forma", () => {
    const texto = montarEnderecoTexto({
      logradouro: undefined,
      numero: undefined,
      bairro: "Centro",
      cidade: null,
      estado: "SP",
    });
    expect(texto).toBe("Centro, SP");
  });
});
