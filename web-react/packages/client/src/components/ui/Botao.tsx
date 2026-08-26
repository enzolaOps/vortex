import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import css from "./Botao.module.css";

/**
 * Botão.
 *
 * Existe porque a fase 4 escreveu a mesma pilha de classes em seis lugares e
 * cada cópia entregou um conjunto diferente de estados — uma tinha `:hover`,
 * nenhuma tinha `:focus-visible`, e `:disabled` só existia como atributo sem
 * aparência correspondente.
 *
 * A referência chama os oito estados de "o que separa protótipo de produto".
 * Centralizá-los num componente é a diferença entre lembrar deles e não
 * conseguir esquecê-los.
 */
export function Botao({
  variante = "neutro",
  icone,
  children,
  className,
  ...props
}: {
  variante?: "primario" | "neutro" | "sutil" | "perigo";
  icone?: ReactNode;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(css.botao, css[variante], className)}
      {...props}
    >
      {icone}
      {children}
    </button>
  );
}
