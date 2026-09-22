import { describe, expect, it } from "vitest";

import { ultimaSecaoAte } from "./grudar";

/*
  Os dois consumidores de `ultimaSecaoAte` precisam concordar — o
  `rangeExtractor` monta o índice e o render o gruda —, e uma divergência de um
  índice produz um cabeçalho que simplesmente não aparece, sem erro nenhum. É o
  tipo de defeito que este projeto já registrou várias vezes, e por isso a
  metade testável foi separada num arquivo puro.
*/
describe("ultimaSecaoAte", () => {
  it("sem seção nenhuma, não há o que grudar", () => {
    expect(ultimaSecaoAte([], 10)).toBeUndefined();
  });

  it("antes da primeira seção, não há o que grudar", () => {
    /* A lista pode começar com membros: `undefined` é ausência, e nunca `-1`,
       que alguém indexaria por engano. */
    expect(ultimaSecaoAte([3, 10], 1)).toBeUndefined();
  });

  it("dentro de uma seção, gruda o cabeçalho dela", () => {
    expect(ultimaSecaoAte([0, 5, 12], 7)).toBe(5);
  });

  it("no índice EXATO do cabeçalho, gruda ele e não o de cima", () => {
    /* Com `<` em vez de `<=`, a coluna anunciaria a seção anterior justamente
       no quadro em que a nova entra — que é quando alguém está olhando. */
    expect(ultimaSecaoAte([0, 5, 12], 5)).toBe(5);
  });

  it("depois da última seção, gruda a última", () => {
    expect(ultimaSecaoAte([0, 5, 12], 400)).toBe(12);
  });
});
