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
}

export interface AssinaturaDeVideo {
  /**
   * Pede (`true`) ou devolve (`false`) a faixa. Devolve `false` quando não há
   * o que assinar — a pessoa saiu, ou nunca publicou aquela fonte.
   */
  assinar(userId: string, fonte: FonteDeVideo, sim: boolean): boolean;
  /**
   * O `ScreenShareAudio` apareceu. Assina só se alguém está assistindo a tela
   * dessa pessoa — o som de uma tela que ninguém abriu não desce.
   */
  audioDaTelaPublicado(userId: string): void;
  /** A sala acabou: nada do que foi contado vale para a próxima. */
  limpar(): void;
}

export function criarAssinaturaDeVideo(
  fontes: FontesDePublicacao,
  atraso = 250,
): AssinaturaDeVideo {
  /**
   * Quantas superfícies querem cada faixa. O ladrilho da grade e a tela de
   * assistir pedem a mesma, e sem contagem quem soltava primeiro derrubava a
   * de quem chegava.
   */
  const assinantes = new Map<string, number>();
  /**
   * Devoluções adiadas. O React roda a limpeza do que sai ANTES do efeito do
   * que entra, então trocar de superfície passa por zero; a espera deixa o
   * pedido de quem chega cancelar a devolução de quem saiu.
   */
  const pendentes = new Map<string, ReturnType<typeof setTimeout>>();
  /**
   * O que está assinado NO TRANSPORTE, e DE QUAL publicação.
   *
   * ⚠ **Guarda o `trackSid`, e não só a chave — é o conserto do "recebendo o
   * primeiro quadro…" que nunca resolvia.** A chave é `usuário:fonte`, estável
   * entre transmissões. Quando a pessoa parava e voltava a transmitir, a
   * publicação nova tinha outro `trackSid`, mas a chave continuava marcada
   * como assinada: o pedido era pulado, a faixa nova nunca descia, e a tela
   * esperava para sempre. Com o `trackSid`, publicação nova é pedido novo.
   */
  const assinado = new Map<string, string>();

  function devolverDepois(userId: string, fonte: FonteDeVideo, chave: string) {
    pendentes.set(
      chave,
      setTimeout(() => {
        pendentes.delete(chave);
        /* Alguém pode ter voltado a querer entre o agendamento e agora. */
        if ((assinantes.get(chave) ?? 0) > 0) return;
        assinado.delete(chave);
        fontes.video(userId, fonte)?.setSubscribed(false);
        /* Devolver os dois, senão o som de uma tela que ninguém vê continua
           tocando — e é o que quem usa ouve primeiro. */
        fontes.audioDaTela(userId, fonte)?.setSubscribed(false);
        faixasDeVideo.apagar(chave);
      }, atraso),
    );
  }

  return {
    assinar(userId, fonte, sim) {
      const chave = chaveDeVideo(userId, fonte);
      const pub = fontes.video(userId, fonte);
      /*
        ⚠ **Pedir sem publicação não conta; devolver sem publicação CONTA.**
        A devolução chega quando a transmissão já acabou — o palco volta para a
        grade porque a publicação sumiu, e só então a limpeza roda. Retornar
        cedo ali deixava um assinante fantasma, e a próxima transmissão da
        mesma pessoa começava com a contagem errada.
      */
      if (sim && !pub) return false;

      const depois = Math.max(
        0,
        (assinantes.get(chave) ?? 0) + (sim ? 1 : -1),
      );
      if (depois === 0) assinantes.delete(chave);
      else assinantes.set(chave, depois);

      const adiado = pendentes.get(chave);
      if (adiado !== undefined) {
        clearTimeout(adiado);
        pendentes.delete(chave);
      }

      if (!sim) {
        if (depois === 0) devolverDepois(userId, fonte, chave);
        return pub !== undefined;
      }
      if (!pub) return false;

      if (assinado.get(chave) !== pub.trackSid) {
        assinado.set(chave, pub.trackSid);
        pub.setSubscribed(true);
        fontes.audioDaTela(userId, fonte)?.setSubscribed(true);
      }

      /*
        `TrackSubscribed` é evento de CHEGADA: assinar o que já chegou não o
        dispara de novo. A faixa já está na publicação; escrevê-la é ler o que
        existe.
      */
      const faixa = pub.track?.mediaStreamTrack;
      if (faixa) faixasDeVideo.set(chave, faixa);
      return true;
    },

    audioDaTelaPublicado(userId) {
      const chave = chaveDeVideo(userId, "tela");
      if ((assinantes.get(chave) ?? 0) === 0) return;
      fontes.audioDaTela(userId, "tela")?.setSubscribed(true);
    },

    limpar() {
      assinantes.clear();
      assinado.clear();
      for (const t of pendentes.values()) clearTimeout(t);
      pendentes.clear();
    },
  };
}
