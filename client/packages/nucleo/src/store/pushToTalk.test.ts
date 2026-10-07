import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apertarTecla,
  assinarPushToTalk,
  lerSegurando,
  soltarTecla,
} from "./pushToTalk";

describe("atraso ao soltar do push-to-talk", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    soltarTecla(0);
  });
  afterEach(() => {
    soltarTecla(0);
    vi.useRealTimers();
  });

  it("segura o microfone aberto pelo atraso e só então fecha", () => {
    apertarTecla();
    soltarTecla(120);
    expect(lerSegurando()).toBe(true);
    vi.advanceTimersByTime(119);
    expect(lerSegurando()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(lerSegurando()).toBe(false);
  });

  it("reapertar dentro do atraso não fecha nem pisca", () => {
    const avisos = vi.fn();
    apertarTecla();
    const parar = assinarPushToTalk(avisos);
    soltarTecla(120);
    vi.advanceTimersByTime(60);
    apertarTecla();
    vi.advanceTimersByTime(500);
    expect(lerSegurando()).toBe(true);
    // Nenhuma transição: o microfone nunca chegou a fechar.
    expect(avisos).not.toHaveBeenCalled();
    parar();
  });

  it("atraso zero fecha na hora", () => {
    apertarTecla();
    soltarTecla(0);
    expect(lerSegurando()).toBe(false);
  });
});
