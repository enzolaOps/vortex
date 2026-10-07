import css from "./primitivos.module.css";

/** Junta classes ignorando o que for falso. */
export function juntar(...classes: readonly (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * A anatomia do menu é a mesma no dropdown e no de contexto; duplicar o estilo
 * faria os dois divergirem na primeira mudança de token.
 */
export const classeDoMenu = juntar(css.vidro, css.camada, css.menu, css.entrada);
export const classeDoItem = css.item;
export const classeDoSeparador = css.separador;
export const classeDoRotulo = css.rotulo;
export { css as estilos };
