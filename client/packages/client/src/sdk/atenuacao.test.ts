import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { atenuacaoValeAgora, criarAtenuador, SEGURAR_MS } from "./atenuacao";

/**
 * Transmitir som e atenuar outros apps se contradizem.
 *
 * A casca baixa o volume de sessão de todo app que não é o Vortex — inclusive
 * o que está sendo transmitido —, e a captura de tela inteira é `loopback`, o
 * mix do dispositivo. Medido em
 * `vendor/stoat-desktop/src/native/atenuacaoModelo.test.ts`.
 */
describe("a preferência vale agora?", () => {
  it("sem transmissão de som, a preferência manda", () => {
    expect(atenuacaoValeAgora({ preferencia: true, transmitindoAudio: false }))
      .toBe(true);
    expect(atenuacaoValeAgora({ preferencia: false, transmitindoAudio: false }))
      .toBe(false);
  });

  it("transmitindo som, não atenua — mesmo com a preferência ligada", () => {
    expect(atenuacaoValeAgora({ preferencia: true, transmitindoAudio: true }))
      .toBe(false);
  });

  it("a preferência não é apagada: sai do ar e ela volta a valer", () => {
    const pessoa = { preferencia: true };
    expect(atenuacaoValeAgora({ ...pessoa, transmitindoAudio: true })).toBe(false);
    expect(atenuacaoValeAgora({ ...pessoa, transmitindoAudio: false })).toBe(true);
  });
});

describe("atenuador", () => {
  let enviados: boolean[];
  beforeEach(() => {
    vi.useFakeTimers();
    enviados = [];
  });
  afterEach(() => vi.useRealTimers());
  const criar = () => criarAtenuador({ enviar: (s) => enviados.push(s) });

  it("liga na hora em que alguém fala", () => {
    criar().atualizar(true, true);
    expect(enviados).toEqual([true]);
  });

  /* A pausa entre palavras não pode devolver o volume. */
  it("pausa curta não desliga", () => {
    const a = criar();
    a.atualizar(true, true);
    a.atualizar(false, true);
    vi.advanceTimersByTime(SEGURAR_MS / 2);
    a.atualizar(true, true);
    vi.advanceTimersByTime(SEGURAR_MS * 2);
    expect(enviados).toEqual([true]);
  });

  it("silêncio de verdade desliga depois do atraso", () => {
    const a = criar();
    a.atualizar(true, true);
    a.atualizar(false, true);
    expect(enviados).toEqual([true]);
    vi.advanceTimersByTime(SEGURAR_MS);
    expect(enviados).toEqual([true, false]);
  });

  it("desligar a preferência ou sair da chamada devolve na hora", () => {
    const a = criar();
    a.atualizar(true, true);
    a.atualizar(true, false);
    expect(enviados).toEqual([true, false]);

    const b = criar();
    enviados = [];
    b.atualizar(true, true);
    b.atualizar(false, true, true);
    expect(enviados).toEqual([true, false]);
  });

  it("com a preferência desligada, nunca liga", () => {
    criar().atualizar(true, false);
    expect(enviados).toEqual([]);
  });

  it("fala repetida não reenvia", () => {
    const a = criar();
    a.atualizar(true, true);
    a.atualizar(true, true);
    expect(enviados).toEqual([true]);
  });
});
