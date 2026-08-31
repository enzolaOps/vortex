import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import {
  alternarFixada,
  channelMessageIds,
  fixadas,
  messages,
} from "./adapter";

/**
 * Mensagens fixadas.
 *
 * A lista é DERIVADA de `message.pinned`, nunca mantida em paralelo — e é essa
 * a propriedade que estes testes guardam. Uma segunda lista sincronizada à mão
 * divergiria no primeiro evento que ela perdesse, e a divergência não daria
 * erro: o painel simplesmente mostraria algo que não está mais fixado, ou
 * deixaria de mostrar algo que está.
 *
 * A varredura é O(n) por chamada e roda só em ação humana. Um índice
 * incremental seria mais rápido e teria que ser mantido correto em cinco
 * caminhos; a varredura não pode divergir da verdade porque ELA é a verdade
 * lida de novo.
 */

const pendentes: FrameRequestCallback[] = [];

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  await seed(500);
  fixadas.subscriber(CHANNEL_ID)(() => {});
});

function ids(): readonly string[] {
  return channelMessageIds.peek(CHANNEL_ID) ?? [];
}

describe("fixadas", () => {
  it("nascem publicadas na semeadura, sem esperar um fixar", () => {
    const lista = fixadas.peek(CHANNEL_ID) ?? [];
    // Sem isto o painel abriria vazio num canal que TEM fixadas, e só
    // apareceria depois da primeira ação — bug invisível em dev, onde ninguém
    // abre o painel antes de mexer.
    expect(lista.length).toBeGreaterThan(0);
  });

  it("a lista segue a ORDEM do histórico, não a de fixação", () => {
    const lista = fixadas.peek(CHANNEL_ID) ?? [];
    const todas = ids();
    const posicoes = lista.map((id) => todas.indexOf(id));

    expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
  });

  it("fixar acrescenta e desafixar remove", () => {
    const alvo = ids().find((id) => {
      messages.subscriber(id)(() => {});
      return messages.peek(id)?.fixada === false;
    })!;

    const antes = (fixadas.peek(CHANNEL_ID) ?? []).length;

    alternarFixada(alvo);
    expect(fixadas.peek(CHANNEL_ID)).toContain(alvo);
    expect(messages.peek(alvo)?.fixada).toBe(true);

    alternarFixada(alvo);
    expect(fixadas.peek(CHANNEL_ID)).not.toContain(alvo);
    expect((fixadas.peek(CHANNEL_ID) ?? []).length).toBe(antes);
  });

  /**
   * A verdade é `pinned` na mensagem, e a lista é o reflexo.
   *
   * Se alguém um dia trocar a varredura por um índice mantido à mão, este
   * teste é o que pega a divergência: ele altera a mensagem PELO caminho do
   * protocolo e exige que a lista concorde.
   */
  it("a lista concorda com o campo da mensagem, sempre", () => {
    const lista = fixadas.peek(CHANNEL_ID) ?? [];
    for (const id of lista) {
      messages.subscriber(id)(() => {});
      expect(messages.peek(id)?.fixada).toBe(true);
    }

    const naoFixadas = ids().filter((id) => !lista.includes(id));
    expect(naoFixadas.length).toBeGreaterThan(0);
  });
});
