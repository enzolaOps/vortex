import type { ElementType, HTMLAttributes, ReactNode } from "react";

import { juntar } from "../juntar";
import css from "./PainelVidro.module.css";

export type VarianteDoVidro = "padrao" | "leitura" | "sobreposto";
/** `sm` (8px) e `md` (12px) vão além do contrato do DS: dica, menu e cartão usam. */
export type RaioDoVidro = "sm" | "md" | "lg" | "xl" | "pill";
export type ElevacaoDoVidro = 1 | 2 | 3;

export interface PainelVidroProps extends HTMLAttributes<HTMLElement> {
  /** padrao = dock e colunas; leitura = chat (mais opaco); sobreposto = menus, cartões e diálogos. */
  variante?: VarianteDoVidro;
  raio?: RaioDoVidro;
  /** 1, 2 (padrão) ou 3 (diálogo, PiP). */
  elevacao?: ElevacaoDoVidro;
  /** Elemento renderizado. Padrão `div`. Use o semântico certo (`nav`, `aside`, `section`). */
  como?: ElementType;
  children?: ReactNode;
}

const RAIO = { sm: css.raioSm, md: css.raioMd, lg: css.raioLg, xl: css.raioXl, pill: css.raioPill } as const;
const ELEVACAO = { 1: css.elev1, 2: css.elev2, 3: css.elev3 } as const;

/**
 * Classe do vidro para quem não pode renderizar `PainelVidro` (os wrappers de
 * Radix recebem a `className` e precisam entregá-la ao conteúdo deles).
 */
export function classeDoVidro(
  variante: VarianteDoVidro = "padrao",
  raio: RaioDoVidro = "lg",
  elevacao: ElevacaoDoVidro = 2,
): string {
  return juntar(css.vidro, css[variante], RAIO[raio], ELEVACAO[elevacao]);
}

export function PainelVidro({
  variante = "padrao",
  raio = "lg",
  elevacao = 2,
  como: Elemento = "div",
  className,
  children,
  ...resto
}: PainelVidroProps) {
  return (
    <Elemento {...resto} className={juntar(classeDoVidro(variante, raio, elevacao), className)}>
      {children}
    </Elemento>
  );
}
