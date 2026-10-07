import { contagem } from "nucleo/lib/plural";

import { comum, ds } from "../../textos";
import { juntar } from "../juntar";
import css from "./Pilula.module.css";

export interface PilulaProps {
  /**
   * aoVivo: selo textual com ponto; mencao: contador retangular "@n"; contagem:
   * número neutro em mono; naoLida: ponto de 7px. Nenhum depende só de cor.
   */
  tipo: "aoVivo" | "mencao" | "contagem" | "naoLida";
  /** Número exibido em `mencao` e `contagem`. */
  valor?: number;
  className?: string;
}

export function Pilula({ tipo, valor = 0, className }: PilulaProps) {
  switch (tipo) {
    case "aoVivo":
      return (
        <span className={juntar(css.pilula, css.aoVivo, className)}>
          <span className={css.ponto} aria-hidden="true" />
          {comum.sinalAoVivo}
        </span>
      );
    case "mencao":
      return (
        <span
          role="img"
          aria-label={ds.mencoes(valor)}
          className={juntar(css.pilula, css.mencao, className)}
        >
          <span aria-hidden="true">@{contagem(valor)}</span>
        </span>
      );
    case "contagem":
      return <span className={juntar(css.pilula, css.contagem, className)}>{contagem(valor)}</span>;
    case "naoLida":
      return (
        <span
          role="img"
          aria-label={ds.naoLida}
          className={juntar(css.pilula, css.naoLida, className)}
        />
      );
  }
}
