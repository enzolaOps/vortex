import { describe, expect, it } from "vitest";

import { alternarPrefixo, analisarBusca, CHIPS } from "./indice";

/**
 * Os chips e os prefixos são a MESMA coisa — é a promessa que o design escreve
 * por extenso: *"quem digita e quem clica chega ao mesmo estado"*.
 *
 * Arquivo separado de `indice.test.ts` porque aquele exercita o índice contra
 * o adapter; este é sobre o parser da busca, que é puro.
 */
describe("prefixos da paleta", () => {
  it("cada chip reconhece o próprio prefixo", () => {
    for (const c of CHIPS) {
      expect(analisarBusca(`${c.prefixo}ger`)).toEqual({
        tipo: c.tipo,
        termo: "ger",
      });
    }
  });

  it("o espaço depois do prefixo é opcional", () => {
    expect(analisarBusca("#  geral")).toEqual({ tipo: "canal", termo: "geral" });
  });

  /**
   * ⚠ **O prefixo só conta no INÍCIO.** `#` no meio é parte do nome de um
   * canal, e tratá-lo como filtro faria `ver #geral` deixar de achar nada.
   */
  it("prefixo no meio da frase não filtra", () => {
    expect(analisarBusca("ver #geral")).toEqual({
      tipo: undefined,
      termo: "ver #geral",
    });
  });

  it("clicar num chip escreve o prefixo e preserva o que já estava digitado", () => {
    expect(alternarPrefixo("geral", "#")).toBe("#geral");
  });

  /** Clicar no chip ATIVO desativa — é toggle, e está no design. */
  it("clicar no chip ativo tira o prefixo", () => {
    expect(alternarPrefixo("#geral", "#")).toBe("geral");
  });

  /** Trocar de chip TROCA o prefixo, em vez de empilhar dois. */
  it("clicar em outro chip substitui o prefixo", () => {
    expect(alternarPrefixo("#ana", "@")).toBe("@ana");
  });

  /**
   * O laço se fecha: escrever o prefixo pelo chip produz exatamente o estado
   * que digitá-lo produz. Sem esta asserção, as duas funções poderiam
   * divergir na primeira que ganhasse um caso especial.
   */
  it("o que o chip escreve é o que o parser lê", () => {
    for (const c of CHIPS) {
      const escrito = alternarPrefixo("ana", c.prefixo);
      expect(analisarBusca(escrito)).toEqual({ tipo: c.tipo, termo: "ana" });
    }
  });
});
