import * as Contexto from "@radix-ui/react-context-menu";
import * as Suspenso from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";

import { classeDoItem, classeDoMenu, classeDoRotulo, classeDoSeparador, juntar } from "./classes";

/**
 * Menus. Item sem `onSelect`, `disabled` ou `asChild` é erro de lint
 * (ITEM_INERTE): item que não faz nada ensina a pessoa a não confiar no menu.
 */

/** `perigo` pinta a ação destrutiva; o resto é igual. */
type ComVariante = { variante?: "perigo" };

// Menu suspenso (botão "mais opções")
export const MenuSuspenso = Suspenso.Root;
export const GatilhoDoMenu = Suspenso.Trigger;

export function ConteudoDoMenu({ className, ...props }: ComponentProps<typeof Suspenso.Content>) {
  return (
    <Suspenso.Portal>
      <Suspenso.Content sideOffset={6} {...props} className={juntar(classeDoMenu, className)} />
    </Suspenso.Portal>
  );
}

export function ItemDeMenu({
  variante,
  className,
  ...props
}: ComponentProps<typeof Suspenso.Item> & ComVariante) {
  return (
    <Suspenso.Item {...props} data-variante={variante} className={juntar(classeDoItem, className)} />
  );
}

export function SeparadorDeMenu({ className, ...props }: ComponentProps<typeof Suspenso.Separator>) {
  return <Suspenso.Separator {...props} className={juntar(classeDoSeparador, className)} />;
}

export function RotuloDeMenu({ className, ...props }: ComponentProps<typeof Suspenso.Label>) {
  return <Suspenso.Label {...props} className={juntar(classeDoRotulo, className)} />;
}

// Menu de contexto (botão direito)
export const MenuDeContexto = Contexto.Root;
export const GatilhoDoMenuDeContexto = Contexto.Trigger;

export function ConteudoDoMenuDeContexto({
  className,
  ...props
}: ComponentProps<typeof Contexto.Content>) {
  return (
    <Contexto.Portal>
      <Contexto.Content {...props} className={juntar(classeDoMenu, className)} />
    </Contexto.Portal>
  );
}

export function ItemDeMenuDeContexto({
  variante,
  className,
  ...props
}: ComponentProps<typeof Contexto.Item> & ComVariante) {
  return (
    <Contexto.Item {...props} data-variante={variante} className={juntar(classeDoItem, className)} />
  );
}

export function SeparadorDeMenuDeContexto({
  className,
  ...props
}: ComponentProps<typeof Contexto.Separator>) {
  return <Contexto.Separator {...props} className={juntar(classeDoSeparador, className)} />;
}

export function RotuloDeMenuDeContexto({
  className,
  ...props
}: ComponentProps<typeof Contexto.Label>) {
  return <Contexto.Label {...props} className={juntar(classeDoRotulo, className)} />;
}
