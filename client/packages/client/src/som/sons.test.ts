import { describe, expect, it } from "vitest";

import { somDaChamada, somDaConexao } from "./sons";

/**
 * Quando um som toca — e, mais importante, quando ele NÃO toca.
 *
 * ⚠ **O efeito é intestável aqui, e por isso a decisão foi separada dele.**
 * `tocar` depende de `AudioContext`, que jsdom não tem: um teste do
 * `ligarSonsDeVoz` inteiro não observaria nada e passaria sempre — que é o
 * mesmo que não ter teste, e a família do "laço que roda zero vezes" que este
 * projeto já registrou duas vezes.
 *
 * O que estas asserções guardam são as regras que alguém pode desfazer sem
 * perceber: som só na entrada CONFIRMADA, mudo só dentro da chamada, e nada
 * na volta da conexão.
 */

const dentro = { estado: "dentro", mudo: false } as const;
const fora = { estado: "fora", mudo: false } as const;
const conectando = { estado: "conectando", mudo: false } as const;

describe("somDaChamada", () => {
  it("toca ao ENTRAR, e só quando a sala aceitou", () => {
    expect(somDaChamada(fora, dentro)).toBe("entrar");
    /* `conectando` é promessa, não chegada: um bipe aqui seguido de falha
       seria pior que silêncio. */
    expect(somDaChamada(fora, conectando)).toBeUndefined();
    expect(somDaChamada(conectando, dentro)).toBe("entrar");
  });

  it("toca ao SAIR, inclusive de uma tentativa que não completou", () => {
    expect(somDaChamada(dentro, fora)).toBe("sair");
    /* Desistir enquanto conectava também é sair — e é o caso em que a pessoa
       mais precisa saber que parou, porque não houve chegada para lembrar. */
    expect(somDaChamada(conectando, fora)).toBe("sair");
  });

  it("não toca quando nada mudou", () => {
    expect(somDaChamada(dentro, dentro)).toBeUndefined();
    expect(somDaChamada(fora, fora)).toBeUndefined();
  });

  it("toca o mudo DENTRO da chamada, nos dois sentidos", () => {
    expect(somDaChamada(dentro, { estado: "dentro", mudo: true })).toBe("mudo");
    expect(somDaChamada({ estado: "dentro", mudo: true }, dentro)).toBe(
      "desmudo",
    );
  });

  it("NÃO toca o mudo fora da chamada", () => {
    /*
      ⚠ A regra que mais fácil se desfaz. Mudo fora da sala é PREFERÊNCIA para
      a próxima — decisão registrada do projeto —, e um som ali afirmaria que
      algo mudou no ar quando não há ar nenhum.
    */
    expect(somDaChamada(fora, { estado: "fora", mudo: true })).toBeUndefined();
  });

  it("a entrada ganha do mudo quando os dois mudam no mesmo evento", () => {
    /*
      Entrar já silenciado publica os dois campos de uma vez. Dois sons
      empilhados no mesmo instante soam como um estalo; o que interessa é ter
      chegado.
    */
    expect(somDaChamada(fora, { estado: "dentro", mudo: true })).toBe("entrar");
  });
});

describe("somDaConexao", () => {
  it("toca na queda", () => {
    expect(somDaConexao("conectado", "reconectando")).toBe("queda");
    expect(somDaConexao("conectado", "sem-conexao")).toBe("queda");
  });

  it("não toca na VOLTA nem no agravamento", () => {
    expect(somDaConexao("reconectando", "conectado")).toBeUndefined();
    /* Já caiu; avisar de novo é insistir sobre um estado que a faixa na tela
       já está mostrando o tempo todo. */
    expect(somDaConexao("reconectando", "sem-conexao")).toBeUndefined();
  });
});
