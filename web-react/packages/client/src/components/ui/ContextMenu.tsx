import * as Primitivo from "@radix-ui/react-context-menu";
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
 * Context menu — o primitivo que decidiu a escolha por Radix.
 *
 * Base UI ainda não tem Context Menu, Hover Card nem Toast, que é exatamente o
 * que um cliente de chat mais usa. Seguir o default do shadcn deixaria as três
 * peças mais difíceis para escrever à mão.
 *
 * O Radix entrega o que é difícil e igual em todo app: roving tabindex, foco
 * devolvido ao lugar certo no Esc, posicionamento contra a borda do viewport,
 * long-press no toque, leitor de tela. Escrever isso à mão é desperdício com
 * acessibilidade quebrada. O estilo é o específico, e é nosso.
 *
 * ⚠ O Radix trava o scroll ao abrir overlay (react-remove-scroll). Abrir este
 * menu sobre a lista virtualizada não pode perder a âncora nem provocar salto
 * ao fechar — é bug que só aparece com histórico longo carregado, e o firehose
 * com 10k é onde se testa.
 */

export const ContextMenu = Primitivo.Root;
export const ContextMenuTrigger = Primitivo.Trigger;

/**
 * Estado vem por data-attribute, não por classe condicional em JS: menos
 * re-render, e o estado fica no DOM onde dá para inspecionar. A altura
 * disponível até a borda do viewport vem como CSS var, então constranger é
 * declarativo em vez de calculado na mão.
 */
export function ContextMenuContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitivo.Content>) {
  return (
    <Primitivo.Portal>
      <Primitivo.Content
        {...props}
        className={cn(
          menuContent,
          "max-h-(--radix-context-menu-content-available-height)",
          className,
        )}
      >
        {children}
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}

export function ContextMenuItem({
  className,
  perigo,
  ...props
}: ComponentProps<typeof Primitivo.Item> & { perigo?: boolean }) {
  return (
    <Primitivo.Item
      {...props}
      className={cn(menuItem, perigo ? menuItemPerigo : menuItemNormal, className)}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitivo.Separator>) {
  return <Primitivo.Separator {...props} className={cn(menuSeparator, className)} />;
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return <Primitivo.Label className={menuLabel}>{children}</Primitivo.Label>;
}
