/**
 * O "Só áudio" automático de quem ASSISTE (D-TELA-22).
 *
 * O design escreve a regra numa linha: *"fallback automático quando o bitrate
 * não sustenta 720p por 10 s"*. Esta é a regra, sem nada de LiveKit nem de
 * React — quem mede é o motor, quem decide é isto, e quem reage é a tela.
 *
 * ⚠ **"Não sustenta 720p" é RECEBIDO abaixo de 720 com a FONTE em 720 ou
 * mais.** Só a altura recebida confundiria duas coisas opostas: a rede
 * derrubando a camada (o que a regra quer pegar) e quem transmite uma janela
 * de 600px (a fonte nunca teve 720). Sem a publicada, desligar o vídeo de
 * quem compartilha uma janela pequena seria punir a pessoa pelo tamanho da
 * janela dela. Sem medida da fonte, não há prova de queda — e sem prova o
 * vídeo fica.
 *
 * ⚠ **Contínuo, e qualquer amostra boa (ou ausente) zera a janela.** Dez
 * segundos somados em pedaços seriam uma rede instável, não uma rede que
 * não sustenta; cortar o vídeo por um engasgo a cada minuto é o contrário
 * de "automática".
 */

export const ALTURA_MINIMA = 720;
export const JANELA_MS = 10_000;

export type AmostraDeRecepcao = {
  /** Altura do quadro que está CHEGANDO, do `RTCStatsReport`. */
  recebida: number | undefined;
  /** Altura que a fonte publica. */
  publicada: number | undefined;
};

export function abaixoDoMinimo(a: AmostraDeRecepcao | undefined): boolean {
  if (a?.recebida === undefined || a.publicada === undefined) return false;
  return a.publicada >= ALTURA_MINIMA && a.recebida < ALTURA_MINIMA;
}

export function criarDetectorDeQueda(janelaMs: number = JANELA_MS) {
  let abaixoDesde: number | undefined;
  return {
    /** Devolve `true` quando a janela inteira passou abaixo do mínimo. */
    amostra(a: AmostraDeRecepcao | undefined, agora: number): boolean {
      if (!abaixoDoMinimo(a)) {
        abaixoDesde = undefined;
        return false;
      }
      abaixoDesde ??= agora;
      return agora - abaixoDesde >= janelaMs;
    },
  };
}
