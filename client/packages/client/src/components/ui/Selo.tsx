import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import css from "./Selo.module.css";

export type FormaDeSelo = "contagem" | "etiqueta";

export type TomDeSelo =
  | "perigo"
  | "perigoSuave"
  | "acento"
  | "aviso"
  | "sucesso"
  | "neutro"
  | "contorno";

const FORMA: Record<FormaDeSelo, string | undefined> = {
  contagem: css.contagem,
  etiqueta: css.etiqueta,
};

const TOM: Record<TomDeSelo, string | undefined> = {
  perigo: css.perigo,
  perigoSuave: css.perigoSuave,
  acento: css.acento,
  aviso: css.aviso,
  sucesso: css.sucesso,
  neutro: css.neutro,
  contorno: css.contorno,
};

/**
 * Contagem ou etiqueta.
 *
 * ⚠ Existia cinco vezes à mão, com quatro geometrias, e já tinha divergido em
 * SIGNIFICADO: a contagem da lista de conversas era ACENTO enquanto as outras
 * eram vermelhas. Medido no design, toda contagem é `#E8596B` — inclusive na
 * lista de DMs.
 */
export function Selo({
  forma = "etiqueta",
  tom = "neutro",
  children,
  className,
  ...props
}: {
  forma?: FormaDeSelo;
  tom?: TomDeSelo;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn(css.selo, FORMA[forma], TOM[tom], className)} {...props}>
      {children}
    </span>
  );
}
