import { describe, expect, it } from "vitest";

import { criarDetectorDeQueda, JANELA_MS } from "./quedaDeQualidade";

const RUIM = { recebida: 540, publicada: 1080 };
const BOA = { recebida: 1080, publicada: 1080 };

describe("criarDetectorDeQueda (D-TELA-22)", () => {
  it("cai para só áudio depois de 10 s CONTÍNUOS abaixo de 720p", () => {
    const d = criarDetectorDeQueda();
    expect(d.amostra(RUIM, 0)).toBe(false);
    expect(d.amostra(RUIM, JANELA_MS - 1)).toBe(false);
    expect(d.amostra(RUIM, JANELA_MS)).toBe(true);
  });

  it("uma amostra boa no meio zera a janela", () => {
    const d = criarDetectorDeQueda();
    d.amostra(RUIM, 0);
    d.amostra(RUIM, 6_000);
    d.amostra(BOA, 7_000);
    expect(d.amostra(RUIM, 8_000)).toBe(false);
    expect(d.amostra(RUIM, 8_000 + JANELA_MS - 1)).toBe(false);
    expect(d.amostra(RUIM, 8_000 + JANELA_MS)).toBe(true);
  });

  it("fonte que nunca teve 720p não é queda — a janela pequena não é culpa da rede", () => {
    const d = criarDetectorDeQueda();
    const pequena = { recebida: 600, publicada: 600 };
    d.amostra(pequena, 0);
    expect(d.amostra(pequena, 60_000)).toBe(false);
  });

  it("sem medida (faixa ainda não chegou, estatística vazia) não prova queda", () => {
    const d = criarDetectorDeQueda();
    d.amostra(RUIM, 0);
    d.amostra(undefined, 5_000);
    expect(d.amostra(RUIM, JANELA_MS)).toBe(false);
    expect(d.amostra({ recebida: 400, publicada: undefined }, 60_000)).toBe(false);
  });

  it("exatamente 720 sustenta", () => {
    const d = criarDetectorDeQueda();
    const limite = { recebida: 720, publicada: 1080 };
    d.amostra(limite, 0);
    expect(d.amostra(limite, 60_000)).toBe(false);
  });
});
