import { afterEach, describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  criarDecodificadorDePcm,
  ehJanela,
  ponteDeAudioDeJanela,
} from "./audioDeJanela";

/**
 * O som de UMA janela compartilhada.
 *
 * ⚠ **O caminho real é inverificável aqui**: ele precisa da casca Electron no
 * Windows, com a captura por processo. O que dá para segurar são as três
 * decisões que decidem se o som chega inteiro e se o do sistema deixa de
 * vazar.
 */

/** Bytes little-endian de amostras de 16 bits. */
function bytes(...amostras: number[]): Uint8Array {
  const b = new Uint8Array(amostras.length * 2);
  amostras.forEach((a, i) => new DataView(b.buffer).setInt16(i * 2, a, true));
  return b;
}

describe("decodificador de PCM", () => {
  it("bloco alinhado vira as amostras que carrega", () => {
    const d = criarDecodificadorDePcm();
    expect([...d(bytes(1, -1, 32767, -32768))]).toEqual([1, -1, 32767, -32768]);
  });

  /* Um byte solto desalinharia todo o resto — ruído puro. */
  it("byte solto espera o próximo bloco, sem deslocar as amostras", () => {
    const d = criarDecodificadorDePcm();
    const tudo = bytes(100, -200, 300, -400);
    expect([...d(tudo.subarray(0, 5))]).toEqual([100, -200]);
    expect([...d(tudo.subarray(5))]).toEqual([300, -400]);
  });

  /* Uma amostra solta trocaria esquerda por direita dali em diante. */
  it("só entrega quadros estéreo INTEIROS", () => {
    const d = criarDecodificadorDePcm();
    const tudo = bytes(1, 2, 3, 4);
    expect([...d(tudo.subarray(0, 6))]).toEqual([1, 2]);
    expect([...d(tudo.subarray(6))]).toEqual([3, 4]);
  });

  /* O IPC pode entregar uma vista num offset ímpar do buffer de origem. */
  it("aceita bloco que começa em offset ímpar", () => {
    const d = criarDecodificadorDePcm();
    const origem = new Uint8Array(9);
    origem.set(bytes(7, -7, 9, -9), 1);
    expect([...d(origem.subarray(1))]).toEqual([7, -7, 9, -9]);
  });
});

/* O ambiente de teste não tem `window`; a casca o injeta de verdade. */
const global_ = globalThis as { window?: { vortexAudioDeJanela?: unknown } };

describe("ponte da casca", () => {
  afterEach(() => {
    delete global_.window;
  });

  it("ausente no navegador", () => {
    global_.window = {};
    expect(ponteDeAudioDeJanela()).toBeUndefined();
  });

  it("incompleta vale como ausente", () => {
    global_.window = {};
    global_.window.vortexAudioDeJanela = {
      disponivel: () => Promise.resolve(true),
      iniciar: () => Promise.resolve(true),
    };
    expect(ponteDeAudioDeJanela()).toBeUndefined();
  });

  it("completa é devolvida", () => {
    const ponte = {
      disponivel: () => Promise.resolve(true),
      iniciar: () => Promise.resolve(true),
      parar: () => Promise.resolve(),
      assinar: () => () => undefined,
    };
    global_.window = { vortexAudioDeJanela: ponte };
    expect(ponteDeAudioDeJanela()).toBe(ponte);
  });

  it("distingue janela de tela pelo id do desktopCapturer", () => {
    expect(ehJanela("window:721790:0")).toBe(true);
    expect(ehJanela("screen:0:0")).toBe(false);
  });
});

/**
 * As ligações que decidem o defeito relatado. Não é prova de comportamento —
 * o motor e a casca não abrem no jsdom —, é prova de que continuam lá.
 */
describe("janela nunca leva o som do sistema", () => {
  const motor = readFileSync(new URL("./motorDeVoz.ts", import.meta.url), "utf8");
  const casca = readFileSync(
    new URL(
      "../../../../../vendor/stoat-desktop/src/native/telaCompartilhada.ts",
      import.meta.url,
    ),
    "utf8",
  );

  it("o cliente só pede áudio ao getDisplayMedia para tela inteira", () => {
    expect(motor).toContain(
      "const audioDoSistema = escolha.audio && !ehJanela(escolha.fonteId);",
    );
    expect(motor).toContain("audio: audioDoSistema ? AUDIO_DA_TELA : false,");
  });

  it("a casca não entrega loopback para janela, mesmo a cliente antigo", () => {
    expect(casca).toContain(
      'escolha.audio && request.audioRequested && !janela',
    );
  });

  it("o som da janela é publicado como áudio da tela e parado com ela", () => {
    expect(motor).toContain("source: Track.Source.ScreenShareAudio,");
    expect(motor).toMatch(
      /pub\.source === Track\.Source\.ScreenShareAudio\s*\)\s*\{\s*pararAudioDaJanela\(\);/,
    );
  });
});
