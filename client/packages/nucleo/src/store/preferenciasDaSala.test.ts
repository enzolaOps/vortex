import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A coluna é lida uma vez, na importação. O teste grava o armazenamento e só
 * então importa de novo — um import estático no topo leria o valor anterior.
 */
const CHAVE = "vortex:preferencias-da-sala";

beforeEach(() => {
  localStorage.removeItem(CHAVE);
});

afterEach(() => {
  localStorage.removeItem(CHAVE);
});

async function carregar() {
  vi.resetModules();
  return import("./preferenciasDaSala");
}

describe("coluna de salas", () => {
  it("começa aberta", async () => {
    const preferencias = await carregar();
    expect(preferencias.lerColunaDeSalas()).toBe("aberta");
  });

  it("recolher persiste a faixa", async () => {
    const preferencias = await carregar();
    preferencias.definirColunaDeSalas("faixa");
    expect(preferencias.lerColunaDeSalas()).toBe("faixa");
    expect(localStorage.getItem(CHAVE)).toContain('"faixa"');
  });

  it("json antigo sem coluna continua aberta e mantém o canto", async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ canto: "tl", gaveta: "lista" }));
    const preferencias = await carregar();
    expect(preferencias.lerColunaDeSalas()).toBe("aberta");
    expect(preferencias.lerCantoDaSala()).toBe("tl");
  });
});
