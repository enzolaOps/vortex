/**
 * O popout da chamada — qual das duas formas está na tela, e onde.
 *
 * ⚠ **Duas formas e não um `compacto` derivado, e a troca é a razão de este
 * store existir.** O cartão anterior escolhia o tamanho sozinho: encolhia
 * quando você olhava outro canal. Isso descrevia o CONTEXTO, não a intenção —
 * quem quer a janelinha mínima enquanto joga não estava "olhando outro canal",
 * e quem lê outra conversa muitas vezes quer ver quem está falando. O design
 * desenha as duas como escolha, com `◱` no cabeçalho para trocar.
 *
 * ⚠ **`fechado` é estado legítimo, e só é honesto porque a chamada continua
 * visível em outros dois lugares:** a faixa de voz no rodapé da coluna de
 * canais e a própria linha do canal, que mostra o cronômetro e você aninhado
 * embaixo. Sem esses dois, fechar seria esconder a única prova de que existe
 * uma chamada — e aí o `✕` do design seria uma armadilha.
 *
 * ⚠ **A posição mora aqui, mas NÃO é escrita durante o arraste.** É a regra
 * que a fase 4 estabeleceu medindo: tocar o store a cada `pointermove`
 * re-renderizaria tudo que o assina, sessenta vezes por segundo. Quem move o
 * elemento durante o gesto é o dono dele, direto no DOM; aqui chega um commit
 * só, no `pointerup`.
 *
 * ⚠ **Não vai no preset.** Posição de janela flutuante é estado de SESSÃO, não
 * preferência de layout — e o preset é compartilhável, então mandar a sua
 * posição de popout junto seria mandar o tamanho do seu monitor.
 */

export type FormaDoPopout = "popout" | "pip" | "fechado";

export interface Popout {
  readonly forma: FormaDoPopout;
  /**
   * Deslocamento a partir do canto de repouso, em px.
   *
   * Deslocamento e não coordenada absoluta: o canto é
   * `inset-block-end/inset-inline-end`, então `{x:0,y:0}` continua ancorado
   * ali em qualquer tamanho de janela. Com coordenada absoluta, encolher a
   * janela deixaria o popout fora dela.
   */
  readonly dx: number;
  readonly dy: number;
}

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

const REPOUSO: Popout = { forma: "popout", dx: 0, dy: 0 };

/** Referência cacheada — armadilha nº 1 do briefing. */
let popout: Popout = REPOUSO;

export function assinarPopout(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerPopout(): Popout {
  return popout;
}

function publicar(proximo: Popout): void {
  popout = proximo;
  for (const o of ouvintes) o();
}

export function definirFormaDoPopout(forma: FormaDoPopout): void {
  if (popout.forma === forma) return;
  popout = { ...popout, forma };
  for (const o of ouvintes) o();
}

/** O commit do arraste — uma vez, no `pointerup`. */
export function moverPopout(dx: number, dy: number): void {
  if (popout.dx === dx && popout.dy === dy) return;
  publicar({ ...popout, dx, dy });
}

/**
 * Volta ao repouso quando a chamada acaba.
 *
 * ⚠ Inclui a POSIÇÃO, e não só a forma. Quem arrastou o popout para o canto
 * superior esquerdo por causa de uma chamada específica não pediu que a
 * próxima nascesse lá — e uma janelinha que aparece num lugar inesperado é
 * pior que uma que aparece sempre no mesmo.
 */
export function reiniciarPopout(): void {
  if (popout === REPOUSO) return;
  publicar(REPOUSO);
}
