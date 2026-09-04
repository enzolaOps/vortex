/**
 * Encaixe de largura na grade, com os extremos como paradas exatas.
 *
 * Extraído da alça porque é lógica pura com um caso de borda que já deu
 * errado uma vez: `Home` no painel de canais devolvia 184px em vez dos 180
 * do mínimo. O snap arredonda para o múltiplo de 8 mais próximo, 184 cai
 * dentro da faixa, e o limite nunca chega a ser aplicado.
 *
 * O sintoma é pequeno e o incômodo não: a pessoa pede o mínimo, não alcança o
 * mínimo, e arrasta de novo contra uma parede que não está onde parece.
 * Encostar no fim do curso tem que colar no fim do curso.
 */

/** Passo do snap: a escala de espaçamento do projeto, não um número novo. */
export const PASSO = 8;

export function encaixar(valor: number): number {
  return Math.round(valor / PASSO) * PASSO;
}

export function encaixarNaFaixa(
  valor: number,
  limites: { min: number; max: number },
): number {
  if (valor <= limites.min) return limites.min;
  if (valor >= limites.max) return limites.max;
  return Math.min(limites.max, Math.max(limites.min, encaixar(valor)));
}
