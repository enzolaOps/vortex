import { describe, expect, it } from "vitest";

import { vizinho } from "./ordem";

/**
 * `vizinho` é o miolo de ⌥↑/↓ e ⌥⌘↑/↓ — quatro atalhos sobre uma função só.
 * Ela é pura, então é aqui que a física deles se prova sem navegador.
 */
describe("vizinho", () => {
  const lista = ["a", "b", "c"];

  it("anda para frente e para trás", () => {
    expect(vizinho(lista, "b", 1)).toBe("c");
    expect(vizinho(lista, "b", -1)).toBe("a");
  });

  /** Circular: quem chega no fim e continua apertando volta ao começo, em vez
      de bater numa parede silenciosa. */
  it("dá a volta nas duas pontas", () => {
    expect(vizinho(lista, "c", 1)).toBe("a");
    expect(vizinho(lista, "a", -1)).toBe("c");
  });

  /**
   * ⚠ **Ausente devolve a PRIMEIRA posição, e não nada.** O caso real é o
   * servidor sem canal aberto: apertar ⌥↓ ali tem que abrir o primeiro canal,
   * não falhar em silêncio — que é o pior comportamento possível de um atalho,
   * porque quem tenta uma vez e não vê nada acontecer não tenta de novo.
   */
  it("sem posição atual, entra pela ponta do sentido", () => {
    expect(vizinho(lista, undefined, 1)).toBe("a");
    expect(vizinho(lista, undefined, -1)).toBe("c");
    expect(vizinho(lista, "fora-da-lista", 1)).toBe("a");
  });

  it("lista vazia não tem vizinho", () => {
    expect(vizinho([], "a", 1)).toBeUndefined();
  });
});
