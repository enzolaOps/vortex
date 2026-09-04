import { MagnifyingGlass } from "./icones";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "../../lib/cn";
import css from "./CampoDeBusca.module.css";

/**
 * ⚠ **O FUNDO não vem daqui, e a omissão é a decisão.**
 *
 * As cinco cópias que este primitivo absorve usavam quatro superfícies
 * diferentes — e três delas estavam certas. O design não fixa um fundo para o
 * campo de busca: ele o põe um degrau ABAIXO do que estiver em volta
 * (`#08090B` na sidebar em `surface-1`, `#1B2028` num painel mais alto). Um
 * valor fixo aqui erraria em três dos cinco lugares, e quem consertasse
 * sobrescreveria — que é como a divergência recomeça.
 *
 * Passe a superfície pelo `className`.
 */
type Comum = {
  /** 30px na coluna de canais, 32 no resto. */
  denso?: boolean;
};

export function CampoDeBusca({
  denso = false,
  className,
  ...props
}: Comum & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size">) {
  return (
    <label className={cn(css.busca, denso && css.denso, className)}>
      <MagnifyingGlass className={css.lupa} aria-hidden />
      <input type="search" className={css.entrada} {...props} />
    </label>
  );
}

/**
 * A variante que é BOTÃO: parece campo, e abre outra coisa.
 *
 * O único consumidor hoje é a coluna de canais, cujo "campo" abre a paleta de
 * comandos — que é um campo de verdade. Ver a nota em `.rotulo`.
 */
export function GatilhoDeBusca({
  denso = false,
  rotulo,
  fim,
  className,
  ...props
}: Comum & {
  rotulo: string;
  /** O que vai na ponta — a tecla de atalho, tipicamente. */
  fim?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  return (
    <button
      type="button"
      className={cn(css.busca, denso && css.denso, className)}
      {...props}
    >
      <MagnifyingGlass className={css.lupa} aria-hidden />
      <span className={css.rotulo}>{rotulo}</span>
      {fim}
    </button>
  );
}
