import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readFileSync } from "node:fs";

import type { QualidadeDeStream } from "./camadaDeVideo";
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
let qualidades: QualidadeDeStream[];
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
    aplicarQualidade: (_u, _f, q) => qualidades.push(q),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  chamadas = [];
  audio = [];
  qualidades = [];
  video = publicacao("TR_v1", () => chamadas, faixa("f1"));
  somDaTela = publicacao("TR_a1", () => audio);
  faixasDeVideo.limpar();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("o áudio da tela acompanha o vídeo", () => {
  it("assinar a tela pede o som junto", () => {
    criar().pedir(USUARIO, "tela");
    expect(chamadas).toEqual([true]);
    expect(audio).toEqual([true]);
  });

  it("devolver a tela devolve o som junto", () => {
    const devolver = criar().pedir(USUARIO, "tela");
    devolver();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true, false]);
    expect(audio).toEqual([true, false]);
  });

  it("trocar de superfície não reconsulta o som", () => {
    const a = criar();
    a.pedir(USUARIO, "tela")();
    a.pedir(USUARIO, "tela");
    vi.advanceTimersByTime(1000);
    expect(audio).toEqual([true]);
  });

  it("câmera NÃO pede som de tela", () => {
    criar().pedir(USUARIO, "camera");
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
    a.pedir(USUARIO, "tela");
    expect(audio).toEqual([]);

    somDaTela = publicacao("TR_a1", () => audio);
    a.audioDaTelaPublicado(USUARIO);
    expect(audio).toEqual([true]);
  });

  it("som da tela publicado depois de parar de assistir não é assinado", () => {
    const a = criar();
    a.pedir(USUARIO, "tela")();
    vi.advanceTimersByTime(1000);
    audio = [];
    a.audioDaTelaPublicado(USUARIO);
    expect(audio).toEqual([]);
  });
});

describe("troca de dono da faixa de vídeo", () => {
  it("trocar da grade para 'Assistir' NÃO consulta o servidor", () => {
    const a = criar();
    a.pedir(USUARIO, "tela")();
    a.pedir(USUARIO, "tela");
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
    expect(faixasDeVideo.getSnapshot(CHAVE)?.id).toBe("f1");
  });

  it("o último a soltar DEVOLVE a faixa, depois da espera", () => {
    const devolver = criar().pedir(USUARIO, "tela");
    chamadas = [];
    devolver();
    expect(chamadas).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(chamadas).toEqual([false]);
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBeUndefined();
  });

  it("dois consumidores ao mesmo tempo assinam uma vez só", () => {
    const a = criar();
    a.pedir(USUARIO, "tela");
    a.pedir(USUARIO, "tela")();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
    expect(faixasDeVideo.getSnapshot(CHAVE)?.id).toBe("f1");
  });

  it("assinar escreve a faixa que já está na publicação", () => {
    criar().pedir(USUARIO, "tela");
    expect(faixasDeVideo.getSnapshot(CHAVE)?.id).toBe("f1");
  });

  it("a camada pedida é aplicada junto com a assinatura", () => {
    criar().pedir(USUARIO, "tela", "alta");
    expect(qualidades).toEqual(["alta"]);
  });

  it("outro ladrilho pedindo outra camada a reaplica sem reassinar", () => {
    const a = criar();
    a.pedir(USUARIO, "tela", "alta");
    a.pedir(USUARIO, "tela", "baixa");
    expect(chamadas).toEqual([true]);
    expect(qualidades).toEqual(["alta", "baixa"]);
  });
});

/**
 * ⚠ **"Fica preso em 'Recebendo o primeiro quadro…'" — relatado por quem
 * usa.** O ladrilho de tela monta pelo `screensharing` do protocolo Stoat, que
 * pode chegar ANTES da publicação do LiveKit.
 */
describe("pedido feito antes da publicação", () => {
  it("é guardado, e cumprido quando a publicação chega, com a camada pedida", () => {
    const a = criar();
    video = undefined;
    a.pedir(USUARIO, "tela", "alta");
    expect(chamadas).toEqual([]);
    expect(qualidades).toEqual([]);

    video = publicacao("TR_v1", () => chamadas);
    a.publicacaoChegou(USUARIO, "tela");
    expect(chamadas).toEqual([true]);
    expect(audio).toEqual([true]);
    expect(qualidades).toEqual(["alta"]);

    /* Uma segunda notícia da mesma publicação não pede de novo. */
    a.publicacaoChegou(USUARIO, "tela");
    expect(chamadas).toEqual([true]);
  });

  it("publicação que chega depois de devolvido NÃO é assinada", () => {
    const a = criar();
    video = undefined;
    a.pedir(USUARIO, "tela")();
    vi.advanceTimersByTime(1000);
    video = publicacao("TR_v1", () => chamadas);
    a.publicacaoChegou(USUARIO, "tela");
    expect(chamadas).toEqual([]);
  });

  /*
    ⚠ **A devolução de quem nunca contou derrubava a faixa de OUTRO ladrilho.**
    O foco montava cedo e não contava; a miniatura pedia com publicação e
    contava 1; o foco desmontava e descontava o que nunca contou.
  */
  it("o foco pede sem publicação, a miniatura pede com, o foco sai: a miniatura segue", () => {
    const a = criar();
    video = undefined;
    const devolverFoco = a.pedir(USUARIO, "tela", "alta");
    video = publicacao("TR_v1", () => chamadas, faixa("f1"));
    a.pedir(USUARIO, "tela", "baixa");
    devolverFoco();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
    expect(faixasDeVideo.getSnapshot(CHAVE)?.id).toBe("f1");
  });

  it("devolver duas vezes desconta uma só", () => {
    const a = criar();
    const devolver = a.pedir(USUARIO, "tela");
    a.pedir(USUARIO, "tela");
    devolver();
    devolver();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
  });

  it("a devolução de um pedido de antes de `limpar` não desconta o da sala nova", () => {
    const a = criar();
    const daSalaVelha = a.pedir(USUARIO, "tela");
    a.limpar();
    chamadas = [];
    a.pedir(USUARIO, "tela");
    daSalaVelha();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
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
    const devolver = a.pedir(USUARIO, "tela");

    /* A transmissão acaba: a publicação some ANTES de a tela desmontar. */
    video = undefined;
    devolver();
    vi.advanceTimersByTime(1000);

    /* Volta a transmitir, com outro `trackSid`, e a pessoa clica em assistir. */
    chamadas = [];
    audio = [];
    video = publicacao("TR_v2", () => chamadas);
    somDaTela = publicacao("TR_a2", () => audio);
    a.pedir(USUARIO, "tela");
    expect(chamadas).toEqual([true]);
    expect(audio).toEqual([true]);
  });

  /* O caso mais apertado: a transmissão nova chega enquanto a tela antiga
     ainda está montada, sem a devolução nunca ter rodado. */
  it("republicação com a tela ainda montada também pede a faixa nova", () => {
    const a = criar();
    a.pedir(USUARIO, "tela");
    chamadas = [];
    video = undefined;
    a.esquecer(USUARIO, "tela");
    video = publicacao("TR_v2", () => chamadas);
    a.publicacaoChegou(USUARIO, "tela");
    expect(chamadas).toEqual([true]);
  });

  /* A devolução sem publicação desconta a contagem: sem isso, a transmissão
     seguinte herdava um assinante fantasma e nunca era devolvida. */
  it("a devolução sem publicação desconta, e a próxima transmissão é devolvida", () => {
    const a = criar();
    const devolver = a.pedir(USUARIO, "tela");
    video = undefined;
    devolver();
    vi.advanceTimersByTime(1000);

    chamadas = [];
    video = publicacao("TR_v2", () => chamadas);
    a.pedir(USUARIO, "tela")();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true, false]);
  });

  it("limpar zera tudo, inclusive devoluções pendentes", () => {
    const a = criar();
    a.pedir(USUARIO, "tela")();
    a.limpar();
    vi.advanceTimersByTime(1000);
    expect(chamadas).toEqual([true]);
  });
});

/**
 * O motor usa a contabilidade como ela é testada aqui.
 *
 * Não é prova de comportamento — isso está em `ligarAssinaturaDeVideo.test.ts`,
 * com um `Room` falso. É prova de que as ligações que decidem os defeitos
 * relatados continuam no motor.
 */
describe("o motor liga a contabilidade", () => {
  const motor = readFileSync(
    new URL("./motorDeVoz.ts", import.meta.url),
    "utf8",
  );

  it("pedirVideo delega para a contabilidade", () => {
    expect(motor).toContain("return assinatura.pedir(userId, fonte, qualidade);");
  });

  it("os eventos que cumprem o pedido são ligados a cada sala", () => {
    expect(motor).toContain(
      "desligarAssinaturaDeVideo = ligarAssinaturaDeVideo(r, assinatura);",
    );
  });

  it("a camada é aplicada pela contabilidade", () => {
    expect(motor).toContain("aplicarQualidade: definirQualidadeDeStream,");
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
