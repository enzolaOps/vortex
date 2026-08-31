import { describe, expect, it } from "vitest";

import { encaixarNaFaixa, PASSO } from "./faixa";
import { LARGURA } from "../preset/schema";

describe("encaixe com extremos exatos", () => {
  it("no meio da faixa, encaixa na grade", () => {
    expect(encaixarNaFaixa(301, { min: 100, max: 500 })).toBe(304);
    expect(encaixarNaFaixa(299, { min: 100, max: 500 })).toBe(296);
  });

  it("os extremos são paradas exatas, mesmo fora da grade", () => {
    // O bug original: min 180 virava 184 porque 184 é múltiplo de 8 e está
    // dentro da faixa, então o limite nunca era aplicado.
    expect(encaixarNaFaixa(180, { min: 180, max: 420 })).toBe(180);
    expect(encaixarNaFaixa(420, { min: 180, max: 420 })).toBe(420);
  });

  it("além dos extremos, cola neles", () => {
    expect(encaixarNaFaixa(-999, { min: 180, max: 420 })).toBe(180);
    expect(encaixarNaFaixa(9999, { min: 180, max: 420 })).toBe(420);
  });

  it("todo painel do projeto alcança o próprio mínimo e máximo", () => {
    // A regressão que este teste guarda não é aritmética: é a pessoa
    // arrastando contra uma parede que não está onde parece.
    for (const limites of Object.values(LARGURA)) {
      expect(encaixarNaFaixa(limites.min, limites)).toBe(limites.min);
      expect(encaixarNaFaixa(limites.max, limites)).toBe(limites.max);
    }
  });

  it("nunca devolve valor fora da faixa", () => {
    const limites = { min: 141, max: 419 };
    for (let v = 100; v <= 460; v += 3) {
      const r = encaixarNaFaixa(v, limites);
      expect(r).toBeGreaterThanOrEqual(limites.min);
      expect(r).toBeLessThanOrEqual(limites.max);
    }
  });

  it("o passo é a escala do projeto", () => {
    expect(PASSO).toBe(8);
  });
});
