import type { HTMLAttributes } from "react";

import { juntar } from "../juntar";
import css from "./FundoVidro.module.css";

/**
 * O fundo do tema Vidro: base escura e três campos de cor desfocados. O vidro
 * dos painéis só tem o que desfocar por causa dele.
 */
export function FundoVidro({ className, children, ...resto }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...resto} className={juntar(css.fundo, className)}>
      <span className={juntar(css.campo, css.teal)} aria-hidden="true" />
      <span className={juntar(css.campo, css.indigo)} aria-hidden="true" />
      <span className={juntar(css.campo, css.magenta)} aria-hidden="true" />
      {children}
    </div>
  );
}
