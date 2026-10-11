import {
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Room,
} from "livekit-client";

import type { AssinaturaDeVideo } from "./assinaturaDeVideo";
import type { FonteDeVideo } from "../store/video";

/**
 * Os eventos do LiveKit que movem a assinatura de vídeo.
 *
 * ⚠ **Fora de `motorDeVoz.ts` para o teste poder montá-lo com um `Room` falso**
 * — o motor importa o `client`, o adapter e meio app; este arquivo só o
 * `livekit-client`, que abre no Node. Quem importa é só o motor, então ele
 * continua no chunk carregado sob demanda.
 *
 * O pedido de vídeo nasce no app (o ladrilho montou), mas quem o CUMPRE é o
 * transporte mudando: sem estes ouvintes, um pedido feito antes da publicação
 * chegar ficava guardado para sempre, e a tela em "Recebendo o primeiro
 * quadro…".
 */

/** A fonte do LiveKit no vocabulário do app, ou nada quando não interessa. */
export function fonteDe(fonte: Track.Source): FonteDeVideo | undefined {
  if (fonte === Track.Source.Camera) return "camera";
  if (fonte === Track.Source.ScreenShare) return "tela";
  return undefined;
}

/** Liga os ouvintes; a função devolvida os desliga. */
export function ligarAssinaturaDeVideo(
  r: Room,
  assinatura: AssinaturaDeVideo,
): () => void {
  /*
    A publicação de vídeo chegou: se um ladrilho já pedia, é aqui que o pedido
    vai ao servidor. É o caso em que o `screensharing` do Stoat ganhou a corrida
    do sinal do LiveKit.
  */
  const aoPublicar = (
    pub: RemoteTrackPublication,
    participante: RemoteParticipant,
  ) => {
    const fonte = fonteDe(pub.source);
    if (fonte) assinatura.publicacaoChegou(participante.identity, fonte);
  };
  /* A publicação sumiu, mas o ladrilho pode continuar querendo: a pessoa pode
     voltar a transmitir, e a publicação seguinte é pedida sem novo pedido. */
  const aoDespublicar = (
    pub: RemoteTrackPublication,
    participante: RemoteParticipant,
  ) => {
    const fonte = fonteDe(pub.source);
    if (fonte) assinatura.esquecer(participante.identity, fonte);
  };
  /*
    ⚠ **Reconectar REASSINA, e é a segunda porta do mesmo defeito.** No
    reinício completo, o LiveKit desfaz os remotos e os recria com publicações
    novas, sem assinatura (`autoSubscribe: false`) e com o MESMO `trackSid`. O
    protocolo segue dizendo `screensharing: true`, o ladrilho continua montado
    e o efeito dele não roda de novo: sem esta varredura, só sair da sala
    destravava.
  */
  const aoReconciliar = () => {
    assinatura.reconciliar();
  };
  const aoSair = (participante: RemoteParticipant) => {
    assinatura.esquecer(participante.identity, "tela");
    assinatura.esquecer(participante.identity, "camera");
  };

  r.on(RoomEvent.TrackPublished, aoPublicar);
  r.on(RoomEvent.TrackUnpublished, aoDespublicar);
  r.on(RoomEvent.Reconnected, aoReconciliar);
  r.on(RoomEvent.ParticipantConnected, aoReconciliar);
  r.on(RoomEvent.ParticipantDisconnected, aoSair);

  return () => {
    r.off(RoomEvent.TrackPublished, aoPublicar);
    r.off(RoomEvent.TrackUnpublished, aoDespublicar);
    r.off(RoomEvent.Reconnected, aoReconciliar);
    r.off(RoomEvent.ParticipantConnected, aoReconciliar);
    r.off(RoomEvent.ParticipantDisconnected, aoSair);
  };
}

/**
 * Onde a contabilidade procura as publicações de uma pessoa, na sala ATUAL.
 *
 * `obterSala` e não a sala: o motor troca de sala sem recriar a contabilidade.
 */
export function publicacoesDaSala(obterSala: () => Room | undefined) {
  function participante(userId: string): RemoteParticipant | undefined {
    for (const p of obterSala()?.remoteParticipants.values() ?? []) {
      if (p.identity === userId) return p;
    }
    return undefined;
  }
  return {
    participante,
    video: (
      userId: string,
      fonte: FonteDeVideo,
    ): RemoteTrackPublication | undefined =>
      participante(userId)?.getTrackPublication(
        fonte === "camera" ? Track.Source.Camera : Track.Source.ScreenShare,
      ),
    /** `undefined` para câmera: o microfone é outra fonte, assinada ao entrar. */
    audioDaTela: (
      userId: string,
      fonte: FonteDeVideo,
    ): RemoteTrackPublication | undefined =>
      fonte === "tela"
        ? participante(userId)?.getTrackPublication(
            Track.Source.ScreenShareAudio,
          )
        : undefined,
  };
}
