import { describe, expect, it } from "vitest";

import { somarPorServidor } from "./somaDeNaoLidas";

const SERVIDOR = { a: "S1", b: "S1", c: "S2", dm: undefined } as Record<string, string | undefined>;

const somar = (
  contagens: [string, { naoLidas: number; mencoes: number }][],
  mudos: string[] = [],
) =>
  Object.fromEntries(
    somarPorServidor(
      contagens,
      (id) => SERVIDOR[id],
      (canal, servidor) => mudos.includes(canal) || mudos.includes(servidor),
    ),
  );

describe("rollup de não-lidas por servidor", () => {
  it("soma os canais de cada servidor, e conversa não entra", () => {
    expect(
      somar([
        ["a", { naoLidas: 2, mencoes: 1 }],
        ["b", { naoLidas: 1, mencoes: 0 }],
        ["c", { naoLidas: 3, mencoes: 0 }],
        ["dm", { naoLidas: 5, mencoes: 5 }],
      ]),
    ).toEqual({ S1: { naoLidas: 3, mencoes: 1 }, S2: { naoLidas: 3, mencoes: 0 } });
  });

  it("canal mudo tira a não-lida e mantém a menção", () => {
    expect(
      somar(
        [
          ["a", { naoLidas: 2, mencoes: 1 }],
          ["b", { naoLidas: 1, mencoes: 0 }],
        ],
        ["a"],
      ),
    ).toEqual({ S1: { naoLidas: 1, mencoes: 1 } });
  });

  it("servidor mudo apaga o realce inteiro, e a menção atravessa", () => {
    expect(
      somar(
        [
          ["a", { naoLidas: 2, mencoes: 1 }],
          ["b", { naoLidas: 1, mencoes: 0 }],
          ["c", { naoLidas: 3, mencoes: 0 }],
        ],
        ["S1"],
      ),
    ).toEqual({ S1: { naoLidas: 0, mencoes: 1 }, S2: { naoLidas: 3, mencoes: 0 } });
  });

  /* Sem entrada zerada: o rail compara ausência, e `{0,0}` acenderia nada
     mas custaria uma republicação. */
  it("servidor que só tinha não-lida muda some do mapa", () => {
    expect(somar([["b", { naoLidas: 1, mencoes: 0 }]], ["S1"])).toEqual({});
  });
});
