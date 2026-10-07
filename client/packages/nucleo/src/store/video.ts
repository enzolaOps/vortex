import { createEphemeralStore } from "./ephemeral";

/**
 * As faixas de vídeo que estão chegando, uma por pessoa e por fonte.
 *
 * ⚠ **`MediaStreamTrack` cru, e nada de LiveKit atravessa daqui.** O motor põe
 * o tipo do navegador; o componente lê o tipo do navegador. A camada
 * anticorrupção vale para o WebRTC do mesmo jeito que vale para o `stoat.js` —
 * e é o que permitiu o palco de transmissão não saber que existe LiveKit.
 *
 * ⚠ **Reusa `createEphemeralStore` por causa da FORMA, não do volume.** O que
 * este store precisa é subscrição por chave com referência estável no
 * `getSnapshot` — exatamente o que o helper faz, e o que a lei nº 1 exige. Ele
 * coalesce em 120ms, o que aqui é irrelevante: faixa aparece quando alguém
 * liga a câmera, não sessenta vezes por segundo. E `apagar` importa: sem ele,
 * uma sessão de 8h acumularia uma entrada por pessoa que já saiu da sala.
 *
 * ⚠ **Ninguém assina isto por assinar.** Com `autoSubscribe: false`, faixa de
 * vídeo só chega depois de alguém PEDIR (`assinarVideo` no motor). Uma tela
 * que monta e lê daqui sem pedir vai encontrar `undefined` e desenhar o
 * avatar, que é o comportamento certo — não um bug.
 */

/** De onde vem o vídeo. As duas fontes do protocolo do LiveKit. */
export type FonteDeVideo = "camera" | "tela";

export const faixasDeVideo = createEphemeralStore<MediaStreamTrack>();

/**
 * A chave.
 *
 * Composta porque a mesma pessoa pode publicar câmera E tela ao mesmo tempo —
 * é o "ladrilho separado" que o design desenha, e fundir as duas numa chave só
 * faria a câmera sobrescrever a transmissão.
 */
export function chaveDeVideo(userId: string, fonte: FonteDeVideo): string {
  return `${userId}:${fonte}`;
}
