import type { QualidadeDeStream } from "./camadaDeVideo";
import { chaveDeVideo, faixasDeVideo, type FonteDeVideo } from "../store/video";

/**
 * A contabilidade de quem quer cada faixa de vídeo remota.
 *
 * ⚠ **Mora fora de `motorDeVoz.ts` para o teste exercitar o código de VERDADE.**
 * Antes o teste reimplementava a álgebra, porque importar o motor carrega o
 * `livekit-client` inteiro; a cópia aprovava um programa que não era o do app,
 * e os dois defeitos corrigidos junto com esta extração moravam justamente no
 * que a cópia não modelava — a identidade da PUBLICAÇÃO e o áudio da tela
 * publicado depois do vídeo. Aqui não há LiveKit: as publicações são injetadas.
 *
 * **Quem pede, e quando.** O app pede por ladrilho (`useAssinaturaDeVideo`, em
 * `app/src/jornadas/voz/hooks.ts`): vídeo só desce enquanto o ladrilho está
 * montado no palco, visível na tela (`IntersectionObserver`) e com a aba aberta.
 * Sair do palco, rolar para fora ou ocultar a aba devolve a faixa (a devolução
 * espera `atraso` ms para a troca foco/miniatura não passar por zero). O motor
 * segue com `autoSubscribe: false`: áudio por evento, vídeo só por este pedido.
 *
 * ⚠ **O PEDIDO é guardado mesmo sem publicação — o conserto do "Recebendo o
 * primeiro quadro…" que ficava para sempre.** O ladrilho de tela monta pelo
 * `screensharing` do protocolo Stoat, que chega pelo websocket; a publicação
 * chega pelo sinal do LiveKit, e os dois não têm ordem. Quando o Stoat ganhava,
 * o pedido era descartado ("sem publicação não conta"), o efeito do ladrilho
 * não rodava de novo e nada no motor reagia ao `TrackPublished` de vídeo. Agora
 * o pedido fica, e quem o cumpre é o TRANSPORTE mudando: `publicacaoChegou`
 * (`TrackPublished`) e `reconciliar` (`Reconnected`, `ParticipantConnected`).
 */

/** O pedaço de `RemoteTrackPublication` que a contabilidade usa. */
export interface PublicacaoAssinavel {
  readonly trackSid: string;
  readonly track?: { readonly mediaStreamTrack: MediaStreamTrack } | undefined;
  setSubscribed(sim: boolean): void;
}

export interface FontesDePublicacao {
  video(userId: string, fonte: FonteDeVideo): PublicacaoAssinavel | undefined;
  /** O `ScreenShareAudio`; `undefined` para câmera, que não tem som próprio. */
  audioDaTela(
    userId: string,
    fonte: FonteDeVideo,
  ): PublicacaoAssinavel | undefined;
  /**
   * Aplica a camada pedida na publicação já assinada. Chamado pela
   * contabilidade no momento em que a assinatura ACONTECE — que pode ser muito
   * depois do pedido, quando a publicação chega.
   */
  aplicarQualidade?(
    userId: string,
    fonte: FonteDeVideo,
    qualidade: QualidadeDeStream,
  ): void;
}

export interface AssinaturaDeVideo {
  /**
   * Pede a faixa e devolve a função que a DEVOLVE.
   *
   * ⚠ **A devolução é a função, e não um `assinar(false)` solto.** Com um
   * booleano, uma devolução de quem nunca contou descontava o pedido de outro
   * ladrilho da mesma tela (miniatura, PiP) e derrubava o vídeo dele. Com a
   * função, só devolve quem pediu, e só uma vez: chamá-la de novo não faz nada.
   */
  pedir(
    userId: string,
    fonte: FonteDeVideo,
    qualidade?: QualidadeDeStream,
  ): () => void;
  /** A publicação de vídeo (`TrackPublished`) apareceu: cumpre o pedido guardado. */
  publicacaoChegou(userId: string, fonte: FonteDeVideo): void;
  /**
   * A publicação deixou de existir (`TrackUnpublished`, `ParticipantDisconnected`).
   * Esquece de QUAL publicação era a assinatura, sem tocar na contagem: o
   * ladrilho continua querendo, e a próxima publicação será pedida.
   */
  esquecer(userId: string, fonte: FonteDeVideo): void;
  /**
   * Varre todo pedido ativo e assina a publicação ATUAL quando ela não é a que
   * foi assinada — inclusive o mesmo `trackSid` num OBJETO novo, que é o que o
   * reinício completo do LiveKit produz.
   */
  reconciliar(): void;
  /** A faixa chegou (`TrackSubscribed`): as falhas daquela chave são esquecidas. */
  faixaChegou(userId: string, fonte: FonteDeVideo): void;
  /**
   * O servidor recusou a assinatura (`TrackSubscriptionFailed`). Tenta de novo
   * com espera crescente, até `MAXIMO_DE_TENTATIVAS` por publicação.
   */
  falhou(userId: string, trackSid: string): void;
  /**
   * O `ScreenShareAudio` apareceu. Assina só se alguém está assistindo a tela
   * dessa pessoa — o som de uma tela que ninguém abriu não desce.
   */
  audioDaTelaPublicado(userId: string): void;
  /** A sala acabou: nada do que foi contado vale para a próxima. */
  limpar(): void;
}

/** Novas tentativas depois de uma falha de assinatura, por publicação. */
export const MAXIMO_DE_TENTATIVAS = 3;
/** Espera antes da 1ª nova tentativa; dobra a cada falha seguinte. */
export const ESPERA_DA_TENTATIVA = 1000;

interface Pedido {
  readonly userId: string;
  readonly fonte: FonteDeVideo;
  /**
   * Quantas superfícies querem esta faixa. O ladrilho da grade e a tela de
   * assistir pedem a mesma, e sem contagem quem soltava primeiro derrubava a
   * de quem chegava.
   */
  contagem: number;
  /** A última camada pedida; reaplicada a cada vez que a assinatura acontece. */
  qualidade: QualidadeDeStream | undefined;
}

export function criarAssinaturaDeVideo(
  fontes: FontesDePublicacao,
  atraso = 250,
): AssinaturaDeVideo {
  const pedidos = new Map<string, Pedido>();
  /**
   * Devoluções adiadas. O React roda a limpeza do que sai ANTES do efeito do
   * que entra, então trocar de superfície passa por zero; a espera deixa o
   * pedido de quem chega cancelar a devolução de quem saiu.
   */
  const pendentes = new Map<string, ReturnType<typeof setTimeout>>();
  /**
   * O que está assinado NO TRANSPORTE, e QUAL publicação — o objeto.
   *
   * ⚠ **O objeto, e não só a chave ou o `trackSid`.** A chave é
   * `usuário:fonte`, estável entre transmissões: parar e voltar a transmitir
   * dá outra publicação. E o `trackSid` sozinho também não basta: no reinício
   * completo o LiveKit desfaz os participantes remotos e os recria com
   * publicações NOVAS e sem assinatura, mas com o MESMO `trackSid` (quem
   * publica não caiu). Comparar o objeto cobre os dois casos.
   */
  const assinado = new Map<string, PublicacaoAssinavel>();
  /** Falhas de assinatura por chave, da publicação de `sid`. */
  const falhas = new Map<string, { sid: string; n: number }>();
  const novasTentativas = new Map<string, ReturnType<typeof setTimeout>>();

  function cancelar(
    mapa: Map<string, ReturnType<typeof setTimeout>>,
    chave: string,
  ) {
    const t = mapa.get(chave);
    if (t === undefined) return;
    clearTimeout(t);
    mapa.delete(chave);
  }

  /**
   * Assina a publicação atual do pedido, se ainda não for ela a assinada.
   * `reaplicar` reaplica a camada mesmo sem assinatura nova — um ladrilho que
   * pede outra camada para a mesma faixa.
   */
  function cumprir(chave: string, reaplicar: boolean) {
    const p = pedidos.get(chave);
    if (!p || p.contagem === 0) return;
    const pub = fontes.video(p.userId, p.fonte);
    if (!pub) return;

    const nova = assinado.get(chave) !== pub;
    if (nova) {
      /* Desistiu desta publicação: só um pedido novo ou outra publicação tentam de novo. */
      const f = falhas.get(chave);
      if (f?.sid === pub.trackSid && f.n > MAXIMO_DE_TENTATIVAS) return;
      assinado.set(chave, pub);
      pub.setSubscribed(true);
      fontes.audioDaTela(p.userId, p.fonte)?.setSubscribed(true);
    }
    if ((nova || reaplicar) && p.qualidade !== undefined) {
      fontes.aplicarQualidade?.(p.userId, p.fonte, p.qualidade);
    }

    /*
      `TrackSubscribed` é evento de CHEGADA: assinar o que já chegou não o
      dispara de novo. A faixa já está na publicação; escrevê-la é ler o que
      existe.
    */
    const faixa = pub.track?.mediaStreamTrack;
    if (faixa) faixasDeVideo.set(chave, faixa);
  }

  function devolverDepois(p: Pedido, chave: string) {
    pendentes.set(
      chave,
      setTimeout(() => {
        pendentes.delete(chave);
        /* Alguém pode ter voltado a querer entre o agendamento e agora. */
        if (pedidos.get(chave) !== p || p.contagem > 0) return;
        pedidos.delete(chave);
        assinado.delete(chave);
        falhas.delete(chave);
        cancelar(novasTentativas, chave);
        fontes.video(p.userId, p.fonte)?.setSubscribed(false);
        /* Devolver os dois, senão o som de uma tela que ninguém vê continua
           tocando — e é o que quem usa ouve primeiro. */
        fontes.audioDaTela(p.userId, p.fonte)?.setSubscribed(false);
        faixasDeVideo.apagar(chave);
      }, atraso),
    );
  }

  return {
    pedir(userId, fonte, qualidade) {
      const chave = chaveDeVideo(userId, fonte);
      let p = pedidos.get(chave);
      if (!p) {
        p = { userId, fonte, contagem: 0, qualidade };
        pedidos.set(chave, p);
      }
      /* Interesse novo: quem desistiu da publicação por falhas tenta de novo. */
      if (p.contagem === 0) falhas.delete(chave);
      p.contagem += 1;
      if (qualidade !== undefined) p.qualidade = qualidade;
      cancelar(pendentes, chave);

      cumprir(chave, true);

      const meu = p;
      let devolvido = false;
      return () => {
        if (devolvido) return;
        devolvido = true;
        /* Depois de `limpar`, o pedido desta sala já não existe — e o de uma
           sala nova com a mesma chave não é deste ladrilho. */
        if (pedidos.get(chave) !== meu) return;
        meu.contagem = Math.max(0, meu.contagem - 1);
        if (meu.contagem === 0) devolverDepois(meu, chave);
      };
    },

    publicacaoChegou(userId, fonte) {
      cumprir(chaveDeVideo(userId, fonte), false);
    },

    esquecer(userId, fonte) {
      const chave = chaveDeVideo(userId, fonte);
      assinado.delete(chave);
      cancelar(novasTentativas, chave);
    },

    reconciliar() {
      for (const chave of pedidos.keys()) cumprir(chave, false);
    },

    faixaChegou(userId, fonte) {
      falhas.delete(chaveDeVideo(userId, fonte));
    },

    falhou(userId, trackSid) {
      for (const fonte of ["tela", "camera"] as const) {
        const chave = chaveDeVideo(userId, fonte);
        if (assinado.get(chave)?.trackSid !== trackSid) continue;
        assinado.delete(chave);
        const antes = falhas.get(chave);
        const n = antes?.sid === trackSid ? antes.n + 1 : 1;
        falhas.set(chave, { sid: trackSid, n });
        cancelar(novasTentativas, chave);
        if (n > MAXIMO_DE_TENTATIVAS) {
          if (import.meta.env.DEV) {
            console.warn(
              `[voz] assinatura de ${chave} falhou ${String(n)} vezes; desistindo desta publicação.`,
            );
          }
          continue;
        }
        novasTentativas.set(
          chave,
          setTimeout(
            () => {
              novasTentativas.delete(chave);
              cumprir(chave, false);
            },
            ESPERA_DA_TENTATIVA * 2 ** (n - 1),
          ),
        );
      }
    },

    audioDaTelaPublicado(userId) {
      const chave = chaveDeVideo(userId, "tela");
      if ((pedidos.get(chave)?.contagem ?? 0) === 0) return;
      fontes.audioDaTela(userId, "tela")?.setSubscribed(true);
    },

    limpar() {
      pedidos.clear();
      assinado.clear();
      falhas.clear();
      for (const t of pendentes.values()) clearTimeout(t);
      pendentes.clear();
      for (const t of novasTentativas.values()) clearTimeout(t);
      novasTentativas.clear();
    },
  };
}
