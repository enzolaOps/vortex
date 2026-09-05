import { describe, expect, it } from "vitest";

import { duracaoCurta } from "./duracao";

/**
 * A duração da chamada, que é o que faz a linha CONTAR algo em vez de
 * registrar. Ver `duracaoCurta`.
 */
describe("duracaoCurta", () => {
  it("abaixo de um minuto conta segundos", () => {
    expect(duracaoCurta(3_000)).toBe("3 s");
    expect(duracaoCurta(44_000)).toBe("44 s");
  });

  /*
    ⚠ A fronteira é onde o arredondamento morde: 59,6s vira 60 segundos, e
    "60 s" é uma resposta que ninguém escreve. Tem de cair para "1 min".
  */
  it("59,6 s vira '1 min' e não '60 s'", () => {
    expect(duracaoCurta(59_600)).toBe("1 min");
  });

  it("entre um minuto e uma hora conta minutos", () => {
    expect(duracaoCurta(60_000)).toBe("1 min");
    expect(duracaoCurta(12 * 60_000)).toBe("12 min");
  });

  /* Mesma fronteira, um degrau acima: 59,5 min arredonda para 60. */
  it("59 min e 40 s vira '1 h' e não '60 min'", () => {
    expect(duracaoCurta(59 * 60_000 + 40_000)).toBe("1 h");
  });

  it("acima de uma hora mostra as duas unidades", () => {
    expect(duracaoCurta(63 * 60_000)).toBe("1 h 3 min");
    expect(duracaoCurta(150 * 60_000)).toBe("2 h 30 min");
  });

  /* O zero não acrescenta e sugere precisão que o arredondamento não tem. */
  it("hora cheia omite os minutos", () => {
    expect(duracaoCurta(2 * 3_600_000)).toBe("2 h");
  });

  /*
    ⚠ Relógio de servidor pode voltar atrás. Sem a guarda, `finishedAt` antes
    de `startedAt` escreveria "-3 s" numa linha que ninguém saberia explicar.
  */
  it("diferença negativa ou inválida vira zero, nunca texto negativo", () => {
    expect(duracaoCurta(-3_000)).toBe("0 s");
    expect(duracaoCurta(Number.NaN)).toBe("0 s");
    expect(duracaoCurta(Number.POSITIVE_INFINITY)).toBe("0 s");
  });
});
