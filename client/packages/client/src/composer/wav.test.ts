import { describe, expect, it } from "vitest";

import {
  DURACAO_MAXIMA_S,
  TAXA_DO_ENVIO,
  codificarWav,
  empurrarNivel,
  formatoDeGravacao,
  nivelDoTrecho,
  nomeDaGravacao,
} from "./wav";

const ascii = (b: ArrayBuffer, de: number, ate: number) =>
  String.fromCharCode(...new Uint8Array(b.slice(de, ate)));

/**
 * O WAV é o que faz a gravação chegar como ÁUDIO. O `autumn` detecta o tipo
 * pelos bytes: sem `RIFF…WAVE` no começo, a mensagem de voz vira cartão de
 * arquivo — sem erro nenhum, e visível só para quem recebe.
 */
describe("codificarWav", () => {
  it("abre com a assinatura que o `infer` do autumn reconhece como audio/x-wav", () => {
    const b = codificarWav(new Float32Array(10), 24_000);
    expect(ascii(b, 0, 4)).toBe("RIFF");
    expect(ascii(b, 8, 12)).toBe("WAVE");
    expect(ascii(b, 12, 16)).toBe("fmt ");
    expect(ascii(b, 36, 40)).toBe("data");
  });

  it("cabeçalho diz PCM 16 bits mono na taxa pedida, com tamanhos coerentes", () => {
    const b = codificarWav(new Float32Array(100), 24_000);
    const v = new DataView(b);
    expect(b.byteLength).toBe(44 + 200);
    expect(v.getUint32(4, true)).toBe(36 + 200);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(24_000);
    expect(v.getUint32(28, true)).toBe(48_000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(200);
  });

  it("satura fora de ±1 em vez de dar a volta no inteiro", () => {
    const b = codificarWav(new Float32Array([2, -2, 0.5, 0]), 8_000);
    const v = new DataView(b);
    expect(v.getInt16(44, true)).toBe(0x7fff);
    expect(v.getInt16(46, true)).toBe(-0x8000);
    expect(v.getInt16(48, true)).toBe(Math.trunc(0.5 * 0x7fff));
    expect(v.getInt16(50, true)).toBe(0);
  });

  it("cinco minutos cabem no teto de 20 MB de attachments", () => {
    const bytes = 44 + DURACAO_MAXIMA_S * TAXA_DO_ENVIO * 2;
    expect(bytes).toBeLessThan(20_000_000);
  });
});

describe("nivelDoTrecho", () => {
  it("silêncio é zero e trecho vazio também", () => {
    expect(nivelDoTrecho(new Float32Array(64))).toBe(0);
    expect(nivelDoTrecho(new Float32Array(0))).toBe(0);
  });

  it("fala baixa ainda levanta a barra, e sinal cheio satura em 1", () => {
    const baixa = nivelDoTrecho(new Float32Array(64).fill(0.05));
    expect(baixa).toBeGreaterThan(0.4);
    expect(baixa).toBeLessThan(1);
    expect(nivelDoTrecho(new Float32Array(64).fill(1))).toBe(1);
  });
});

describe("empurrarNivel", () => {
  it("guarda só os n mais recentes e devolve array novo", () => {
    const a = [0.1, 0.2, 0.3];
    const b = empurrarNivel(a, 0.4, 3);
    expect(b).toEqual([0.2, 0.3, 0.4]);
    expect(b).not.toBe(a);
    expect(empurrarNivel([], 0.5, 3)).toEqual([0.5]);
  });
});

describe("formatoDeGravacao", () => {
  it("prefere webm/opus, cai para o próximo suportado, e no fim deixa o navegador escolher", () => {
    expect(formatoDeGravacao(() => true)).toBe("audio/webm;codecs=opus");
    expect(formatoDeGravacao((t) => t.startsWith("audio/ogg"))).toBe(
      "audio/ogg;codecs=opus",
    );
    expect(formatoDeGravacao(() => false)).toBe("");
  });
});

describe("nomeDaGravacao", () => {
  it("é datado, com zero à esquerda, e termina em .wav", () => {
    expect(nomeDaGravacao(new Date(2026, 8, 3, 7, 5))).toBe(
      "mensagem-de-voz-2026-09-03-0705.wav",
    );
  });
});
