import { classeDoVidro, type RaioDoVidro } from "../ds/PainelVidro";
import { juntar } from "../juntar";
import css from "./primitivos.module.css";

export { juntar };

/**
 * Receita das sobreposições: o vidro vem do `PainelVidro` (único dono do
 * `backdrop-filter`); aqui só se acrescenta a tipografia base das camadas.
 */
export const vidro = (raio: RaioDoVidro = "md") =>
  juntar(classeDoVidro("sobreposto", raio, 2), css.texto);
export const vidroElevado = (raio: RaioDoVidro = "md") =>
  juntar(classeDoVidro("sobreposto", raio, 3), css.texto);

/**
 * A anatomia do menu é a mesma no dropdown e no de contexto; duplicar o estilo
 * faria os dois divergirem na primeira mudança de token.
 */
export const classeDoMenu = juntar(vidro(), css.camada, css.menu, css.entrada);
export const classeDoItem = css.item;
export const classeDoSeparador = css.separador;
export const classeDoRotulo = css.rotulo;
export { css as estilos };
