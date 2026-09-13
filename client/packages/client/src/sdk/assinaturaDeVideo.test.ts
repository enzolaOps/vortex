import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import { faixasDeVideo, type FonteDeVideo } from "../store/video";
import {
  criarAssinaturaDeVideo,
  type PublicacaoAssinavel,
} from "./assinaturaDeVideo";

/**
 * A troca de dono de uma faixa de vídeo, e o som da tela.
 *
 * ⚠ **Testa o módulo de VERDADE.** Antes este arquivo reimplementava a
 * contagem, porque importar `motorDeVoz` carrega o `livekit-client` inteiro; a
 * contabilidade saiu do motor para `assinaturaDeVideo.ts`, sem LiveKit, e as
 * publicações é que são dubladas. Os dois defeitos corrigidos junto moravam no
 * que a cópia não modelava.
 */

const USUARIO = "01JQ0000000000000001000000";
const CHAVE = `${USUARIO}:tela`;

let chamadas: boolean[];
let audio: boolean[];
let video: PublicacaoAssinavel | undefined;
let somDaTela: PublicacaoAssinavel | undefined;

function publicacao(
  sid: string,
  destino: () => boolean[],
  faixa?: MediaStreamTrack,
): PublicacaoAssinavel {
  return {
    trackSid: sid,
    track: faixa ? { mediaStreamTrack: faixa } : undefined,
    setSubscribed: (v) => destino().push(v),
  };
}

function faixa(id: string): MediaStreamTrack {
  return { id } as MediaStreamTrack;
}

function criar() {
  return criarAssinaturaDeVideo({
    video: () => video,
    audioDaTela: (_u: string, fonte: FonteDeVideo) =>
      fonte === "tela" ? somDaTela : undefined,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  chamadas = [];
  audio = [];
  video = publicacao("TR_v1", () => chamadas, faixa("f1"));
  somDaTela = publicacao("TR_a1", () => audio);
  faixasDeVideo.limpar();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("o áudio da tela acompanha o vídeo", () => {
  it("assinar a tela pede o som junto", () => {
    criar().assinar(USUARIO, "tela", true);
    expect(chamadas).toEqual([true]);
    expect(audio).toEqual([true]);
  });

  it("devolver a tela devolve o som junto", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", false);
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true, false]);
    expect(audio).toEqual([true, false]);
  });

  it("trocar de superfície não reconsulta o som", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", false);
    a.assinar(USUARIO, "tela", true);
    vi.advanceTimersByTime(1000);
    expect(audio).toEqual([true]);
  });

  it("câmera NÃO pede som de tela", () => {
    criar().assinar(USUARIO, "camera", true);
    expect(chamadas).toEqual([true]);
    expect(audio).toEqual([]);
  });

  /*
    ⚠ **"Mesmo não assistindo a tela eu consigo escutar o áudio" — relatado por
    quem usa.** O som da tela publicado com ninguém assistindo não desce.
  */
  it("som da tela publicado SEM ninguém assistindo não é assinado", () => {
    criar().audioDaTelaPublicado(USUARIO);
    expect(audio).toEqual([]);
  });

  /* O `ScreenShareAudio` costuma chegar logo depois do vídeo. Quem já está
     assistindo tem de receber o som mesmo assim. */
  it("som da tela publicado DEPOIS do vídeo, com alguém assistindo, é assinado", () => {
    const a = criar();
    somDaTela = undefined;
    a.assinar(USUARIO, "tela", true);
    expect(audio).toEqual([]);

    somDaTela = publicacao("TR_a1", () => audio);
    a.audioDaTelaPublicado(USUARIO);
    expect(audio).toEqual([true]);
  });

  it("som da tela publicado depois de parar de assistir não é assinado", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", false);
    vi.advanceTimersByTime(1000);
    audio = [];
    a.audioDaTelaPublicado(USUARIO);
    expect(audio).toEqual([]);
  });
});

describe("troca de dono da faixa de vídeo", () => {
  it("trocar da grade para 'Assistir' NÃO consulta o servidor", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", false);
    a.assinar(USUARIO, "tela", true);
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
    expect(faixasDeVideo.getSnapshot(CHAVE)?.id).toBe("f1");
  });

  it("o último a soltar DEVOLVE a faixa, depois da espera", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    chamadas = [];
    a.assinar(USUARIO, "tela", false);
    expect(chamadas).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(chamadas).toEqual([false]);
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBeUndefined();
  });

  it("dois consumidores ao mesmo tempo assinam uma vez só", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", false);
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
    expect(faixasDeVideo.getSnapshot(CHAVE)?.id).toBe("f1");
  });

  it("assinar escreve a faixa que já está na publicação", () => {
    criar().assinar(USUARIO, "tela", true);
    expect(faixasDeVideo.getSnapshot(CHAVE)?.id).toBe("f1");
  });

  it("sem publicação, pedir devolve false e não assina nada", () => {
    video = undefined;
    expect(criar().assinar(USUARIO, "tela", true)).toBe(false);
    expect(chamadas).toEqual([]);
  });
});

/**
 * ⚠ **"Em algumas horas fica só em 'recebendo o primeiro quadro…'" —
 * relatado por quem usa.** A chave `usuário:tela` é estável entre
 * transmissões; a publicação não é.
 */
describe("a pessoa para e volta a transmitir", () => {
  it("publicação NOVA é pedida de novo, mesmo com a chave já assinada", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);

    /* A transmissão acaba: a publicação some ANTES de a tela desmontar. */
    video = undefined;
    a.assinar(USUARIO, "tela", false);
    vi.advanceTimersByTime(1000);

    /* Volta a transmitir, com outro `trackSid`, e a pessoa clica em assistir. */
    chamadas = [];
    audio = [];
    video = publicacao("TR_v2", () => chamadas);
    somDaTela = publicacao("TR_a2", () => audio);
    expect(a.assinar(USUARIO, "tela", true)).toBe(true);
    expect(chamadas).toEqual([true]);
    expect(audio).toEqual([true]);
  });

  /* O caso mais apertado: a transmissão nova chega enquanto a tela antiga
     ainda está montada, sem a devolução nunca ter rodado. */
  it("republicação com a tela ainda montada também pede a faixa nova", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    chamadas = [];
    video = publicacao("TR_v2", () => chamadas);
    a.assinar(USUARIO, "tela", true);
    expect(chamadas).toEqual([true]);
  });

  /* A devolução sem publicação desconta a contagem: sem isso, a transmissão
     seguinte herdava um assinante fantasma e nunca era devolvida. */
  it("a devolução sem publicação desconta, e a próxima transmissão é devolvida", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    video = undefined;
    a.assinar(USUARIO, "tela", false);
    vi.advanceTimersByTime(1000);

    chamadas = [];
    video = publicacao("TR_v2", () => chamadas);
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", false);
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true, false]);
  });

  it("limpar zera tudo, inclusive devoluções pendentes", () => {
    const a = criar();
    a.assinar(USUARIO, "tela", true);
    a.assinar(USUARIO, "tela", false);
    a.limpar();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
  });
});

/**
 * O motor usa a contabilidade como ela é testada aqui.
 *
 * Não é prova de comportamento — o motor carrega `livekit-client` e não abre
 * no jsdom. É prova de que as três ligações que decidem os defeitos relatados
 * continuam lá.
 */
describe("o motor liga a contabilidade", () => {
  const motor = readFileSync(
    new URL("./motorDeVoz.ts", import.meta.url),
    "utf8",
  );

  it("assinarVideo delega para a contabilidade", () => {
    expect(motor).toContain("return assinatura.assinar(userId, fonte, sim);");
  });

  it("o som da tela publicado passa pela contabilidade, não pelo áudio geral", () => {
    expect(motor).toMatch(
      /if \(pub\.source === Track\.Source\.ScreenShareAudio\) \{\s*assinatura\.audioDaTelaPublicado/,
    );
  });

  it("o áudio já publicado ao entrar deixa o som da tela de fora", () => {
    expect(motor).toMatch(
      /function assinarAudioExistente[\s\S]*?pub\.source !== Track\.Source\.ScreenShareAudio/,
    );
  });

  it("TrackUnsubscribed só apaga a faixa que de fato saiu", () => {
    expect(motor).toContain(
      "if (faixasDeVideo.getSnapshot(chave) === faixa.mediaStreamTrack) {",
    );
  });
});
