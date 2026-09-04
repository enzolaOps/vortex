import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import {
  alternarReacao,
  channelMessageIds,
  messages,
  usuarioLocalId,
} from "./adapter";

/**
 * Reações.
 *
 * O que já existia era RENDERIZAÇÃO: o snapshot achatava para
 * `Map<emoji, número>`, e a contagem sozinha não diz se EU reagi. Sem isso o
 * chip não sabe se está aceso, e o clique não sabe se adiciona ou remove.
 *
 * O que estes testes protegem é o toggle e a limpeza — as duas coisas que
 * quebram sem erro. Um Set vazio deixado para trás não aparece na tela (o
 * mapa já pula emoji sem ninguém) e mesmo assim guarda a POSIÇÃO daquele
 * emoji na ordem dos chips: reagir de novo o traria de volta ao lugar antigo
 * em vez do fim, e ninguém saberia dizer por quê.
 */

const pendentes: FrameRequestCallback[] = [];

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  await seed(60);
});

function virarFrame() {
  const fila = pendentes.splice(0, pendentes.length);
  for (const cb of fila) cb(0);
}

/** Uma mensagem assinada — o store não guarda o que ninguém observa. */
function assinada(indice = 0): string {
  const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
  const id = ids[indice]!;
  messages.subscriber(id)(() => {});
  return id;
}

describe("reações", () => {
  it("o arnês semeia reações, e uma delas é minha", () => {
    const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
    for (const id of ids) messages.subscriber(id)(() => {});

    const todas = ids.flatMap((id) => messages.peek(id)?.reactions ?? []);

    expect(todas.length).toBeGreaterThan(0);
    // Os dois lados: sem uma minha, o chip aceso nunca teria exercício; sem
    // uma alheia, o apagado também não.
    expect(todas.some((r) => r.minha)).toBe(true);
    expect(todas.some((r) => !r.minha)).toBe(true);
  });

  it("reagir acrescenta com total 1 e marcada como minha", () => {
    const id = assinada();
    expect(messages.peek(id)?.reactions.some((r) => r.emoji === "🎉")).toBe(false);

    alternarReacao(id, "🎉");
    virarFrame();

    const nova = messages.peek(id)?.reactions.find((r) => r.emoji === "🎉");
    expect(nova).toMatchObject({ emoji: "🎉", total: 1, minha: true });
    /*
      E a amostra de QUEM reagiu traz você — é o dado que o tooltip de reação
      nomeia, e sem esta linha ele passaria a vir vazio sem nada reprovar.
    */
    expect(nova?.quem).toEqual([usuarioLocalId()]);
  });

  it("clicar de novo remove, e não deixa o emoji para trás", () => {
    const id = assinada(1);

    alternarReacao(id, "🎉");
    virarFrame();
    alternarReacao(id, "🎉");
    virarFrame();

    const reacoes = messages.peek(id)?.reactions ?? [];
    // Nem com total 0, nem como entrada fantasma: some inteiro.
    expect(reacoes.some((r) => r.emoji === "🎉")).toBe(false);
  });

  /**
   * A ordem dos chips é estável, e é isso que impede que eles dancem.
   *
   * Removida a última reação de um emoji, a chave morre. Reagir com ele de
   * novo entra no FIM — porque é uma reação nova, não a mesma de antes.
   */
  it("emoji removido e reposto entra no fim, não no lugar antigo", () => {
    const id = assinada(2);

    alternarReacao(id, "🅰");
    alternarReacao(id, "🅱");
    virarFrame();
    expect(messages.peek(id)?.reactions.map((r) => r.emoji)).toEqual(["🅰", "🅱"]);

    alternarReacao(id, "🅰");
    virarFrame();
    expect(messages.peek(id)?.reactions.map((r) => r.emoji)).toEqual(["🅱"]);

    alternarReacao(id, "🅰");
    virarFrame();
    expect(messages.peek(id)?.reactions.map((r) => r.emoji)).toEqual(["🅱", "🅰"]);
  });

  it("reagir a uma mensagem NÃO toca as outras", () => {
    const alvo = assinada(3);
    const vizinha = assinada(4);
    const antes = messages.peek(vizinha);

    alternarReacao(alvo, "🎉");
    virarFrame();

    // Referência idêntica: o snapshot da vizinha nem foi reescrito. É a lei
    // nº 1 medida em vez de afirmada.
    expect(messages.peek(vizinha)).toBe(antes);
  });
});
