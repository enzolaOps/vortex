import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventEmitter } from "node:events";

import { RoomEvent, Track, type Room } from "livekit-client";

import type { QualidadeDeStream } from "./camadaDeVideo";
import { criarAssinaturaDeVideo } from "./assinaturaDeVideo";
import {
  ligarAssinaturaDeVideo,
  publicacoesDaSala,
} from "./ligarAssinaturaDeVideo";
import { faixasDeVideo } from "../store/video";

/**
 * Os eventos do LiveKit cumprindo o pedido de vídeo, com um `Room` FALSO e a
 * contabilidade de verdade.
 *
 * O `Room` falso é um `EventEmitter` com `remoteParticipants`: é tudo o que
 * `ligarAssinaturaDeVideo` e `publicacoesDaSala` leem. A ordem dos eventos é a
 * que o diagnóstico descreve para produção — o `screensharing` do Stoat
 * montando o ladrilho antes de o `TrackPublished` chegar, e o reinício
 * completo recriando as publicações com o mesmo `trackSid`.
 */

const ANA = "01JQ0000000000000001000000";

interface PublicacaoFalsa {
  trackSid: string;
  source: Track.Source;
  kind: Track.Kind;
  track: undefined;
  pedidos: boolean[];
  setSubscribed(sim: boolean): void;
}

function publicacao(
  trackSid: string,
  source = Track.Source.ScreenShare,
): PublicacaoFalsa {
  const pedidos: boolean[] = [];
  return {
    trackSid,
    source,
    kind: Track.Kind.Video,
    track: undefined,
    pedidos,
    setSubscribed: (sim) => pedidos.push(sim),
  };
}

class ParticipanteFalso {
  readonly publicacoes = new Map<Track.Source, PublicacaoFalsa>();
  constructor(readonly identity: string) {}
  getTrackPublication(source: Track.Source) {
    return this.publicacoes.get(source);
  }
}

class SalaFalsa extends EventEmitter {
  readonly remoteParticipants = new Map<string, ParticipanteFalso>();
}

let sala: SalaFalsa;
let qualidades: string[];
let desligar: () => void;

function montar() {
  const pubs = publicacoesDaSala(() => sala as unknown as Room);
  const assinatura = criarAssinaturaDeVideo({
    video: pubs.video,
    audioDaTela: pubs.audioDaTela,
    aplicarQualidade: (u, f, q: QualidadeDeStream) =>
      qualidades.push(`${u}:${f}:${q}`),
  });
  desligar = ligarAssinaturaDeVideo(sala as unknown as Room, assinatura);
  return assinatura;
}

/** Ana entra na sala (sem nada publicado ainda). */
function anaEntra(): ParticipanteFalso {
  const p = new ParticipanteFalso(ANA);
  sala.remoteParticipants.set(ANA, p);
  sala.emit(RoomEvent.ParticipantConnected, p);
  return p;
}

function publicar(p: ParticipanteFalso, pub: PublicacaoFalsa) {
  p.publicacoes.set(pub.source, pub);
  sala.emit(RoomEvent.TrackPublished, pub, p);
}

beforeEach(() => {
  vi.useFakeTimers();
  sala = new SalaFalsa();
  qualidades = [];
  faixasDeVideo.limpar();
});

afterEach(() => {
  desligar();
  vi.useRealTimers();
});

describe("TrackPublished cumpre o pedido guardado", () => {
  it("o ladrilho pede ANTES da publicação; o TrackPublished de vídeo assina com a camada pedida", () => {
    const assinatura = montar();
    const ana = anaEntra();

    /* O `screensharing` do Stoat montou o ladrilho: pedido sem publicação. */
    assinatura.pedir(ANA, "tela", "alta");
    expect(qualidades).toEqual([]);

    const tela = publicacao("TR_tela");
    publicar(ana, tela);
    expect(tela.pedidos).toEqual([true]);
    expect(qualidades).toEqual([`${ANA}:tela:alta`]);
  });

  it("o áudio da tela publicado antes do vídeo não engana o pedido de vídeo", () => {
    const assinatura = montar();
    const ana = anaEntra();
    assinatura.pedir(ANA, "tela", "media");

    const som = publicacao("TR_som", Track.Source.ScreenShareAudio);
    som.kind = Track.Kind.Audio;
    publicar(ana, som);
    const tela = publicacao("TR_tela");
    publicar(ana, tela);
    expect(tela.pedidos).toEqual([true]);
    expect(som.pedidos).toEqual([true]);
  });

  it("publicação de vídeo que ninguém pediu NÃO é assinada", () => {
    montar();
    const ana = anaEntra();
    const camera = publicacao("TR_cam", Track.Source.Camera);
    publicar(ana, camera);
    expect(camera.pedidos).toEqual([]);
  });

  it("parar e voltar a transmitir com o ladrilho montado pede a publicação nova", () => {
    const assinatura = montar();
    const ana = anaEntra();
    assinatura.pedir(ANA, "tela", "alta");
    const velha = publicacao("TR_1");
    publicar(ana, velha);

    ana.publicacoes.delete(Track.Source.ScreenShare);
    sala.emit(RoomEvent.TrackUnpublished, velha, ana);
    const nova = publicacao("TR_2");
    publicar(ana, nova);
    expect(nova.pedidos).toEqual([true]);
  });
});

describe("os ouvintes saem", () => {
  it("a função devolvida desliga todos os eventos", () => {
    montar();
    expect(sala.eventNames().length).toBe(2);
    desligar();
    expect(sala.eventNames()).toEqual([]);
  });
});
