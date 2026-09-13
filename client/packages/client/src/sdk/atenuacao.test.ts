import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarAtenuador, SEGURAR_MS } from "./atenuacao";

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
