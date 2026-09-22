import { describe, expect, it } from "vitest";

import {
  barrasAcesas,
  dbDaFracao,
  dbDoRms,
  decidirPorta,
  faixaDaBarra,
  fracaoDoDb,
  PORTA_FECHADA,
  rmsDe,
  SEGURAR_PORTA_MS,
  textoDoDb,
} from "./nivelDeAudio";

describe("nível em dB", () => {
  it("converte RMS em dBFS e prende no piso e no teto", () => {
    expect(dbDoRms(1)).toBe(0);
    expect(Math.round(dbDoRms(0.1))).toBe(-20);
    expect(dbDoRms(0)).toBe(-60);
    expect(dbDoRms(4)).toBe(0);
  });

  it("mede o RMS de um bloco", () => {
    expect(rmsDe(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rmsDe(new Float32Array(0))).toBe(0);
  });

  it("fração e dB são inversas — é o que mantém a marca honesta", () => {
    for (const db of [-60, -42, -18, 0]) {
      expect(dbDaFracao(fracaoDoDb(db))).toBe(db);
    }
    expect(dbDaFracao(-1)).toBe(-60);
    expect(dbDaFracao(2)).toBe(0);
  });

  it("acende barras pelo nível, e nenhuma sem medição", () => {
    expect(barrasAcesas(undefined)).toBe(0);
    expect(barrasAcesas(-60)).toBe(0);
    expect(barrasAcesas(0)).toBe(28);
    // O "−18 dB testando" do design acende 20 de 28.
    expect(barrasAcesas(-18)).toBe(20);
  });

  it("pinta as faixas pelas regras do design: >19 amarelo, >24 vermelho", () => {
    expect(faixaDaBarra(0)).toBe("ok");
    expect(faixaDaBarra(19)).toBe("ok");
    expect(faixaDaBarra(20)).toBe("alto");
    expect(faixaDaBarra(24)).toBe("alto");
    expect(faixaDaBarra(25)).toBe("pico");
    expect(faixaDaBarra(27)).toBe("pico");
  });

  it("escreve o dB com o menos tipográfico", () => {
    expect(textoDoDb(-42)).toBe("−42 dB");
    expect(textoDoDb(-41.6)).toBe("−42 dB");
    expect(textoDoDb(0)).toBe("0 dB");
  });
});

describe("porta de voz", () => {
  it("abre ao passar do limiar", () => {
    const p = decidirPorta(PORTA_FECHADA, -30, -42, 1000);
    expect(p.aberta).toBe(true);
  });

  it("fica fechada abaixo do limiar", () => {
    expect(decidirPorta(PORTA_FECHADA, -50, -42, 1000).aberta).toBe(false);
  });

  it("segura aberta entre sílabas e só fecha depois da espera", () => {
    const aberta = decidirPorta(PORTA_FECHADA, -30, -42, 1000);
    const entreSilabas = decidirPorta(aberta, -55, -42, 1000 + SEGURAR_PORTA_MS - 1);
    expect(entreSilabas.aberta).toBe(true);
    const silencio = decidirPorta(entreSilabas, -55, -42, 1000 + SEGURAR_PORTA_MS);
    expect(silencio.aberta).toBe(false);
  });

  it("devolve a MESMA referência quando nada muda", () => {
    const fechada = decidirPorta(PORTA_FECHADA, -55, -42, 1000);
    expect(decidirPorta(fechada, -56, -42, 2000)).toBe(fechada);
  });
});
