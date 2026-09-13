import type { CSSProperties } from "react";

import type { PinturaDeCargo } from "../tema/cargo";

/**
 * As props de um NOME pintado pelo cargo, nas superfícies onde o gradiente
 * entra.
 *
 * Uma função e não duas cópias do ternário: a lista de membros e a prévia do
 * editor precisam desenhar o mesmo nome do mesmo jeito, e a prévia que diverge
 * da lista é justamente a que mente para quem está escolhendo.
 *
 * `color` vai junto mesmo no gradiente — é a primeira parada, e é o que resta
 * quando `forced-colors` descarta a imagem de fundo (ver
 * `styles/pinturaDeCargo.module.css`).
 */
export function propsDoNome(pintura: PinturaDeCargo | undefined): {
  "data-pintura"?: "gradiente";
  style?: CSSProperties;
} {
  if (!pintura) return {};
  if (pintura.tipo === "solida") return { style: { color: pintura.cor } };
  return {
    "data-pintura": "gradiente",
    style: {
      color: pintura.cor,
      "--pintura-cargo": pintura.texto,
    } as CSSProperties,
  };
}
