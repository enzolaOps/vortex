import { describe, expect, it } from "vitest";

import { contagem, plural, rotuloDeNaoLidas } from "./plural";

/**
 * "1 menções" saiu na primeira verificação em navegador, num texto que só
 * leitor de tela lê. Concordância errada não quebra nada e ninguém relê —
 * é candidato de manual a mecanismo em vez de atenção.
 */
describe("contagem", () => {
  it("passa direto até o teto", () => {
    expect(contagem(0)).toBe("0");
    expect(contagem(99)).toBe("99");
  });

  it("acima do teto vira 99+", () => {
    expect(contagem(100)).toBe("99+");
    expect(contagem(4000)).toBe("99+");
  });
});

describe("plural", () => {
  it("singular no 1", () => {
    expect(plural(1, "menção", "menções")).toBe("1 menção");
    expect(plural(2, "menção", "menções")).toBe("2 menções");
  });

  /**
   * Surpresa registrada, não contornada.
   *
   * O CLDR põe o ZERO na categoria `one` em português — a regra é `i = 0..1` —
   * então `Intl.PluralRules` devolve "0 menção", que soa errado em pt-BR.
   *
   * Fica assim de propósito: o rótulo nunca renderiza com zero (quem chama
   * verifica `naoLidas > 0` antes), e divergir do CLDR com um `n === 0`
   * especial trocaria uma regra padronizada por uma exceção nossa para cobrir
   * um caso inalcançável. O teste existe para que a próxima pessoa encontre a
   * explicação em vez de "consertar" isto às cegas.
   */
  it("zero cai em `one` no CLDR de português — e não é renderizado", () => {
    expect(plural(0, "menção", "menções")).toBe("0 menção");
  });

  it("acima do teto é sempre plural — '99+ menção' não existe", () => {
    expect(plural(500, "menção", "menções")).toBe("99+ menções");
  });
});

describe("rótulo de não-lidas", () => {
  it("sem menção, só a contagem", () => {
    expect(rotuloDeNaoLidas(1, 0)).toBe("1 não lida");
    expect(rotuloDeNaoLidas(7, 0)).toBe("7 não lidas");
  });

  it("com menção, as duas concordam em separado", () => {
    expect(rotuloDeNaoLidas(3, 1)).toBe("1 menção, 3 não lidas");
    expect(rotuloDeNaoLidas(1, 1)).toBe("1 menção, 1 não lida");
  });
});
