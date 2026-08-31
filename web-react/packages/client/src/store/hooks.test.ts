import { describe, expect, it } from "vitest";

import { assertStable } from "./hooks";

/**
 * A assertion que guarda a armadilha nº 1 do projeto.
 *
 * Ela vive no wrapper do `useSyncExternalStore` e só roda em dev, o que
 * significa que nunca disparou em nenhuma corrida deste projeto — e mecanismo
 * que nunca disparou é prosa com sintaxe de código. Este teste é o disparo.
 */
describe("assertStable", () => {
  it("aceita getter que devolve referência cacheada", () => {
    const fixo = { texto: "oi" };
    expect(() => assertStable(() => fixo, "cacheado")).not.toThrow();
  });

  it("aceita primitivo, que é estável por valor", () => {
    expect(() => assertStable(() => "offline", "primitivo")).not.toThrow();
  });

  it("explode no getter que aloca a cada chamada", () => {
    // O caso real: `.map()`, `.filter()` ou spread dentro do getter. Sem esta
    // assertion o sintoma é a aba travando, sem erro no console.
    expect(() => assertStable(() => ({ texto: "oi" }), "aloca")).toThrow(
      /getSnapshot instável/,
    );
  });

  it("explode no getter que devolve array novo", () => {
    const fonte = ["a", "b"];
    expect(() => assertStable(() => [...fonte], "spread")).toThrow(
      /getSnapshot instável/,
    );
  });

  it("nomeia o culpado na mensagem", () => {
    expect(() => assertStable(() => ({}), "useMessage(abc123)")).toThrow(
      /useMessage\(abc123\)/,
    );
  });
});
