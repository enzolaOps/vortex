import { beforeEach, describe, expect, it } from "vitest";

import {
  aplicarToque,
  assinarChamadaRecebida,
  lerChamadaRecebida,
  limparChamadaRecebida,
  proximoToque,
  SEM_TOQUE,
  TOQUE_MS,
  type ContextoDoToque,
  type EstadoDoToque,
} from "./chamadaRecebida";

/**
 * Quando uma chamada toca — e, mais importante, quando ela NÃO toca.
 *
 * As regras que alguém pode desfazer sem perceber são as de silêncio: a sua
 * própria ligação voltando para você, a chamada recusada tocando de novo
 * quando o segundo sinal do protocolo chega, e a segunda ligação trocando o
 * aviso debaixo do ponteiro.
 */

const EU = "eu";
const ctx: ContextoDoToque = { eu: EU, canalDaChamada: "" };

const comecou = (channelId = "dm", quemLigou = "marina", agora = 1000) =>
  ({ tipo: "comecou", channelId, quemLigou, agora, visivel: true }) as const;

function tocando(): EstadoDoToque {
  return proximoToque(SEM_TOQUE, comecou(), ctx);
}

describe("proximoToque", () => {
  it("toca quando alguém liga", () => {
    const e = tocando();
    expect(e.tocando).toEqual({
      channelId: "dm",
      quemLigou: "marina",
      desde: 1000,
      visivel: true,
    });
  });

  it("não toca a própria ligação, nem sem sessão", () => {
    expect(proximoToque(SEM_TOQUE, comecou("dm", EU), ctx)).toBe(SEM_TOQUE);
    expect(
      proximoToque(SEM_TOQUE, comecou(), { eu: undefined, canalDaChamada: "" }),
    ).toBe(SEM_TOQUE);
  });

  it("não toca a sala em que você já está", () => {
    expect(
      proximoToque(SEM_TOQUE, comecou(), { eu: EU, canalDaChamada: "dm" }),
    ).toBe(SEM_TOQUE);
  });

  it("deduplica as duas fontes do protocolo — mesma referência", () => {
    const e = tocando();
    expect(proximoToque(e, comecou("dm", "marina", 1500), ctx)).toBe(e);
  });

  it("a primeira chamada fica, a segunda não troca o aviso", () => {
    const e = tocando();
    expect(proximoToque(e, comecou("grupo", "teo", 1200), ctx)).toBe(e);
  });

  it("para quando a sala esvazia", () => {
    const e = proximoToque(tocando(), { tipo: "terminou", channelId: "dm" }, ctx);
    expect(e.tocando).toBeUndefined();
  });

  it("terminar OUTRO canal não mexe no que toca", () => {
    const e = tocando();
    expect(proximoToque(e, { tipo: "terminou", channelId: "x" }, ctx)).toBe(e);
  });

  it("expira depois da janela, e não antes", () => {
    const e = tocando();
    expect(
      proximoToque(e, { tipo: "expirou", agora: 1000 + TOQUE_MS - 1 }, ctx),
    ).toBe(e);
    expect(
      proximoToque(e, { tipo: "expirou", agora: 1000 + TOQUE_MS }, ctx).tocando,
    ).toBeUndefined();
  });

  it("recusada NÃO volta a tocar com o segundo sinal", () => {
    const recusada = proximoToque(tocando(), { tipo: "recusou", agora: 1100 }, ctx);
    expect(recusada.tocando).toBeUndefined();
    expect(proximoToque(recusada, comecou("dm", "marina", 1600), ctx).tocando)
      .toBeUndefined();
  });

  it("a recusa vale só pela janela — ligar de novo depois toca", () => {
    const recusada = proximoToque(tocando(), { tipo: "recusou", agora: 1100 }, ctx);
    const depois = 1100 + TOQUE_MS;
    expect(proximoToque(recusada, comecou("dm", "marina", depois), ctx).tocando)
      .toBeDefined();
  });

  it("a sala esvaziar solta a recusa na hora", () => {
    const recusada = proximoToque(tocando(), { tipo: "recusou", agora: 1100 }, ctx);
    const vazia = proximoToque(recusada, { tipo: "terminou", channelId: "dm" }, ctx);
    expect(proximoToque(vazia, comecou("dm", "marina", 1300), ctx).tocando)
      .toBeDefined();
  });

  it("atender também impede o eco do segundo sinal", () => {
    const atendida = proximoToque(tocando(), { tipo: "atendeu", agora: 1100 }, ctx);
    expect(proximoToque(atendida, comecou("dm", "marina", 1400), ctx).tocando)
      .toBeUndefined();
  });

  it("expirada não reacende com um sinal atrasado", () => {
    const expirada = proximoToque(
      tocando(),
      { tipo: "expirou", agora: 1000 + TOQUE_MS },
      ctx,
    );
    expect(
      proximoToque(expirada, comecou("dm", "marina", 1000 + TOQUE_MS - 1), ctx)
        .tocando,
    ).toBeUndefined();
  });
});

describe("o store", () => {
  beforeEach(() => limparChamadaRecebida());

  it("publica só quando quem toca muda", () => {
    let vezes = 0;
    const parar = assinarChamadaRecebida(() => (vezes += 1));

    aplicarToque(comecou(), ctx);
    const primeiro = lerChamadaRecebida();
    aplicarToque(comecou("dm", "marina", 1200), ctx);
    expect(lerChamadaRecebida()).toBe(primeiro);
    expect(vezes).toBe(1);

    aplicarToque({ tipo: "recusou", agora: 1300 }, ctx);
    expect(lerChamadaRecebida()).toBeUndefined();
    expect(vezes).toBe(2);
    parar();
  });
});
