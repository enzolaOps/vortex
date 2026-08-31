import * as Primitivo from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";
import {
  menuContent,
  menuItem,
  menuItemNormal,
  menuItemPerigo,
  menuLabel,
  menuSeparator,
} from "./menu";

/**
 * Dropdown menu — menu do servidor, menu do usuário, o "..." da mensagem.
 *
 * Mesma anatomia do context menu, gatilho diferente: aqui o menu é ancorado a
 * um botão em vez de ao ponteiro, então o Radix precisa saber a largura do
 * gatilho para constranger a sua. Isso vem como CSS var, não como cálculo.
 */

export const DropdownMenu = Primitivo.Root;
export const DropdownMenuTrigger = Primitivo.Trigger;

export function DropdownMenuContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitivo.Content>) {
  return (
    <Primitivo.Portal>
      <Primitivo.Content
        sideOffset={4}
        {...props}
        className={cn(
          menuContent,
          "max-h-(--radix-dropdown-menu-content-available-height)",
          className,
        )}
      >
        {children}
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}

export function DropdownMenuItem({
  className,
  perigo,
  ...props
}: ComponentProps<typeof Primitivo.Item> & { perigo?: boolean }) {
  return (
    <Primitivo.Item
      {...props}
      className={cn(
        menuItem,
        perigo ? menuItemPerigo : menuItemNormal,
        className,
      )}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitivo.Separator>) {
  return <Primitivo.Separator {...props} className={cn(menuSeparator, className)} />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <Primitivo.Label className={menuLabel}>{children}</Primitivo.Label>;
}
