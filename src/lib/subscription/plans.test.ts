import { describe, expect, it } from "vitest";

import {
  calcularValorAssinaturaMotorista,
  calcularExpiraEmAssinatura,
  calcularTesteExpiraEm,
  contaEmTeste,
  diasRestantesConta,
  formatarBRL,
  TESTE_DIAS,
} from "@/lib/subscription/plans";

const planoBase = { alunosGratis: 5, valorPorAlunoExcedente: 1.2 };

describe("calcularValorAssinaturaMotorista", () => {
  it("cobra só o valor base quando o plano não permite anos adicionais", () => {
    const resumo = calcularValorAssinaturaMotorista({
      plano: { ...planoBase, valorBase: 100, permiteAnosAdicionais: false },
      anosAdicionais: 5, // deve ser ignorado
    });
    expect(resumo.anosAdicionais).toBe(0);
    expect(resumo.valorAnosAdicionais).toBe(0);
    expect(resumo.valorTotal).toBe(100);
  });

  it("soma anos adicionais quando o plano permite", () => {
    const resumo = calcularValorAssinaturaMotorista({
      plano: { ...planoBase, valorBase: 200, permiteAnosAdicionais: true },
      anosAdicionais: 3,
    });
    expect(resumo.anosAdicionais).toBe(3);
    expect(resumo.valorAnosAdicionais).toBe(600);
    expect(resumo.valorTotal).toBe(800);
  });

  it("nunca aceita anos adicionais negativos ou fracionados", () => {
    const resumo = calcularValorAssinaturaMotorista({
      plano: { ...planoBase, valorBase: 100, permiteAnosAdicionais: true },
      anosAdicionais: -2,
    });
    expect(resumo.anosAdicionais).toBe(0);

    const fracionado = calcularValorAssinaturaMotorista({
      plano: { ...planoBase, valorBase: 100, permiteAnosAdicionais: true },
      anosAdicionais: 2.9,
    });
    expect(fracionado.anosAdicionais).toBe(2);
  });

  it("assume 0 anos adicionais quando não informado", () => {
    const resumo = calcularValorAssinaturaMotorista({
      plano: { ...planoBase, valorBase: 50, permiteAnosAdicionais: true },
    });
    expect(resumo.valorTotal).toBe(50);
  });

  it("repassa alunosGratis/valorPorAlunoExcedente do plano (informativo — não entra no valorTotal)", () => {
    const resumo = calcularValorAssinaturaMotorista({
      plano: { alunosGratis: 10, valorPorAlunoExcedente: 1.2, valorBase: 300, permiteAnosAdicionais: false },
    });
    expect(resumo.alunosGratis).toBe(10);
    expect(resumo.valorAlunosExcedentes).toBe(1.2);
    expect(resumo.valorTotal).toBe(300);
  });
});

describe("calcularExpiraEmAssinatura", () => {
  const inicio = new Date(Date.UTC(2026, 0, 15)); // 15 jan 2026

  it("soma 1 mês para ciclo mensal", () => {
    const expira = calcularExpiraEmAssinatura("MENSAL", 0, inicio);
    expect(expira.getUTCFullYear()).toBe(2026);
    expect(expira.getUTCMonth()).toBe(1); // fevereiro
    expect(expira.getUTCDate()).toBe(15);
  });

  it("soma 6 meses para ciclo semestral", () => {
    const expira = calcularExpiraEmAssinatura("SEMESTRAL", 0, inicio);
    expect(expira.getUTCFullYear()).toBe(2026);
    expect(expira.getUTCMonth()).toBe(6); // julho
  });

  it("soma 1 ano (+ anos adicionais) para ciclo anual", () => {
    const semAdicional = calcularExpiraEmAssinatura("ANUAL", 0, inicio);
    expect(semAdicional.getUTCFullYear()).toBe(2027);

    const comAdicional = calcularExpiraEmAssinatura("ANUAL", 2, inicio);
    expect(comAdicional.getUTCFullYear()).toBe(2029);
  });

  it("não sofre mutação da data original (from)", () => {
    const original = new Date(inicio);
    calcularExpiraEmAssinatura("ANUAL", 0, inicio);
    expect(inicio.getTime()).toBe(original.getTime());
  });
});

describe("teste grátis (calcularTesteExpiraEm / contaEmTeste / diasRestantesConta)", () => {
  it(`calcularTesteExpiraEm soma ${TESTE_DIAS} dias`, () => {
    const inicio = new Date(Date.UTC(2026, 0, 1));
    const expira = calcularTesteExpiraEm(inicio);
    const diffDias = (expira.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDias).toBe(TESTE_DIAS);
  });

  it("contaEmTeste é true antes de expirar e false depois", () => {
    const expiraEm = new Date(Date.UTC(2026, 0, 10));
    expect(contaEmTeste(expiraEm, new Date(Date.UTC(2026, 0, 5)))).toBe(true);
    expect(contaEmTeste(expiraEm, new Date(Date.UTC(2026, 0, 15)))).toBe(false);
  });

  it("diasRestantesConta nunca retorna negativo", () => {
    const expiraEm = new Date(Date.UTC(2026, 0, 1));
    const agora = new Date(Date.UTC(2026, 0, 10));
    expect(diasRestantesConta(expiraEm, agora)).toBe(0);
  });

  it("diasRestantesConta arredonda pra cima (qualquer fração de dia conta como 1)", () => {
    const agora = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
    const expiraEm = new Date(Date.UTC(2026, 0, 2, 1, 0, 0)); // 1 dia + 1h
    expect(diasRestantesConta(expiraEm, agora)).toBe(2);
  });
});

describe("formatarBRL", () => {
  it("formata número como moeda brasileira", () => {
    // Intl usa espaço não separável (U+00A0) entre "R$" e o valor.
    expect(formatarBRL(1234.5).replace(/ /g, " ")).toBe("R$ 1.234,50");
  });

  it("formata zero corretamente", () => {
    expect(formatarBRL(0).replace(/ /g, " ")).toBe("R$ 0,00");
  });
});
