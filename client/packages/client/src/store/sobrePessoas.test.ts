import { describe, expect, it } from "vitest";

import { escreverNota, LIMITE_DA_NOTA, lerNota } from "./sobrePessoas";

describe("nota privada (D-DMN-11)", () => {
  it("guarda o espaço digitado no fim — senão a palavra seguinte cola", () => {
    escreverNota("u1", "Onde ");
    expect(lerNota("u1")).toBe("Onde ");
    escreverNota("u1", "Onde nos");
    expect(lerNota("u1")).toBe("Onde nos");
  });

  it("corta no teto de 256, inclusive ao colar", () => {
    escreverNota("u2", "x".repeat(LIMITE_DA_NOTA + 40));
    expect(lerNota("u2")).toHaveLength(LIMITE_DA_NOTA);
  });

  it("nota só de espaço vira ausência", () => {
    escreverNota("u3", "algo");
    escreverNota("u3", "   ");
    expect(lerNota("u3")).toBe("");
  });
});
