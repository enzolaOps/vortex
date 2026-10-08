import { beforeEach, describe, expect, it, vi } from "vitest";

import { assinarAparencia, definirAparencia, lerAparencia, limparAparencia } from "./aparencia";

beforeEach(() => {
  limparAparencia();
});

describe("aparência", () => {
  it("nasce no desenho de fábrica e segue o sistema nas animações", () => {
    expect(lerAparencia()).toEqual({ vidro: 100, brilho: 100, texto: 100, reduzirAnimacoes: null });
  });

  it("limita cada ajuste à própria faixa", () => {
    definirAparencia({ vidro: 400, brilho: -5, texto: 300 });
    expect(lerAparencia()).toMatchObject({ vidro: 100, brilho: 0, texto: 125 });
    definirAparencia({ texto: 10 });
    expect(lerAparencia().texto).toBe(90);
  });

  it("guarda no dispositivo e mexer em nada não acorda ninguém", () => {
    const ouvinte = vi.fn();
    const sair = assinarAparencia(ouvinte);
    definirAparencia({ vidro: 40 });
    expect(JSON.parse(localStorage.getItem("vortex:aparencia") ?? "{}")).toMatchObject({ vidro: 40 });
    definirAparencia({ vidro: 40 });
    expect(ouvinte).toHaveBeenCalledTimes(1);
    sair();
  });

  it("referência estável entre leituras", () => {
    expect(lerAparencia()).toBe(lerAparencia());
  });

  it("armazenamento bloqueado não derruba a escolha", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    try {
      definirAparencia({ brilho: 20 });
      expect(lerAparencia().brilho).toBe(20);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
