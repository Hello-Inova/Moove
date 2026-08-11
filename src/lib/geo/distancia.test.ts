import { describe, expect, it } from "vitest";

import { haversineMetros, estimarEtaMinutos } from "@/lib/geo/distancia";

describe("haversineMetros", () => {
  it("retorna 0 para o mesmo ponto", () => {
    const p = { latitude: -23.55052, longitude: -46.633308 };
    expect(haversineMetros(p, p)).toBeCloseTo(0, 6);
  });

  it("calcula a distância aproximada entre dois pontos conhecidos (Praça da Sé -> Ibirapuera, SP)", () => {
    // Distância em linha reta real ≈ 5.4 km — tolerância generosa porque é
    // só pra travar regressões grosseiras na fórmula, não validar geodésia.
    const praçaDaSe = { latitude: -23.5505, longitude: -46.6333 };
    const ibirapuera = { latitude: -23.5874, longitude: -46.6576 };
    const metros = haversineMetros(praçaDaSe, ibirapuera);
    expect(metros).toBeGreaterThan(4000);
    expect(metros).toBeLessThan(6500);
  });

  it("é simétrica (a->b === b->a)", () => {
    const a = { latitude: -23.5505, longitude: -46.6333 };
    const b = { latitude: -22.9068, longitude: -43.1729 };
    expect(haversineMetros(a, b)).toBeCloseTo(haversineMetros(b, a), 6);
  });

  it("cresce com a distância real (ponto mais longe = mais metros)", () => {
    const origem = { latitude: -23.5505, longitude: -46.6333 };
    const perto = { latitude: -23.551, longitude: -46.6333 };
    const longe = { latitude: -23.6, longitude: -46.6333 };
    expect(haversineMetros(origem, longe)).toBeGreaterThan(haversineMetros(origem, perto));
  });
});

describe("estimarEtaMinutos", () => {
  it("retorna 0 minutos para distância 0", () => {
    expect(estimarEtaMinutos(0)).toBe(0);
  });

  it("é proporcional à distância (o dobro da distância = o dobro do tempo)", () => {
    const eta1 = estimarEtaMinutos(1000);
    const eta2 = estimarEtaMinutos(2000);
    expect(eta2).toBeCloseTo(eta1 * 2, 6);
  });

  it("aplica o fator de sinuosidade (tempo estimado > tempo em linha reta a 22km/h)", () => {
    // A 22km/h sem ajuste, 1000m levariam ~2.73min — com o fator de
    // sinuosidade (1.3x) o resultado tem que ser maior que isso.
    const semAjuste = 1000 / ((22 * 1000) / 60);
    expect(estimarEtaMinutos(1000)).toBeGreaterThan(semAjuste);
  });

  it("nunca retorna tempo negativo para distância positiva", () => {
    expect(estimarEtaMinutos(500)).toBeGreaterThan(0);
  });
});
