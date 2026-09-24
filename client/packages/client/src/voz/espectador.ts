/**
 * O que a coluna do palco escreve sobre cada espectador (D-TELA-16).
 *
 * Puro: a linha assina o anúncio da pessoa e chama isto; o teste cobre as
 * quatro frases do design sem montar nada.
 */

import type { Assistindo } from "../store/espectadores";

export interface EstadoDoEspectador {
  readonly assistindo: boolean;
  readonly texto: string;
  /** A resolução caiu sem a pessoa pedir — pinta em `warning`. */
  readonly rede: boolean;
}

/**
 * As quatro frases do design, nesta precedência: tela cheia ganha da
 * resolução (quem está em tela cheia está vendo o que a tela dá), e a
 * resolução só aparece quando foi medida — "assistindo · undefinedp" seria
 * o pior dos rótulos.
 */
export function estadoDoEspectador(
  anuncio: readonly Assistindo[],
  dono: string,
): EstadoDoEspectador {
  const a = anuncio.find((x) => x.dono === dono);
  if (!a) return { assistindo: false, texto: "não está assistindo", rede: false };
  if (a.cheia) return { assistindo: true, texto: "assistindo em tela cheia", rede: false };
  if (a.altura === undefined) return { assistindo: true, texto: "assistindo", rede: false };
  return {
    assistindo: true,
    texto: `assistindo · ${String(a.altura)}p${a.rede ? " (rede)" : ""}`,
    rede: a.rede,
  };
}

/**
 * Quem aparece na coluna, e em que ordem: quem assiste primeiro, depois o
 * resto da sala — o dono da tela fica de fora, porque ele não é espectador de
 * si mesmo. Dentro de cada grupo vale a ordem da sala, que é estável; reordenar
 * por nome acordaria a coluna a cada entrada.
 */
export function ordemDosEspectadores(
  participantes: readonly string[],
  espectadores: readonly string[],
  dono: string,
): { readonly lista: readonly string[]; readonly assistindo: number; readonly total: number } {
  const assistem = new Set(espectadores);
  const dentro = participantes.filter((id) => id !== dono);
  const primeiro = dentro.filter((id) => assistem.has(id));
  const depois = dentro.filter((id) => !assistem.has(id));
  return {
    lista: [...primeiro, ...depois],
    assistindo: primeiro.length,
    total: dentro.length,
  };
}
