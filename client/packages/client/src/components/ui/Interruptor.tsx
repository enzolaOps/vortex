import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";
import css from "./Interruptor.module.css";

export type InterruptorProps = {
  ligado: boolean;
  /**
   * Nomeia o RECURSO, nunca a ação.
   *
   * ⚠ "Canal privado", não "Tornar canal privado". Um rótulo que alterna junto
   * do estado faz o leitor anunciar o inverso — regra que o lint do projeto já
   * pegou uma vez nos controles de microfone.
   */
  rotulo: string;
  aoAlternar: (ligado: boolean) => void;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-checked" | "aria-label" | "role" | "onClick"
>;

/**
 * Interruptor de duas posições.
 *
 * `role="switch"` num `<button>` e não um `<input type="checkbox">`: o nativo
 * é desenhado pelo SISTEMA, e num app escuro no Windows ele abre com cromo
 * claro — a mesma regra de lint que trocou os `<select>` do modal de enquete.
 */
export function Interruptor({
  ligado,
  rotulo,
  aoAlternar,
  className,
  disabled,
  ...props
}: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      className={cn(css.trilho, className)}
      onClick={() => aoAlternar(!ligado)}
      {...props}
    >
      <span className={css.polegar} aria-hidden />
    </button>
  );
}
