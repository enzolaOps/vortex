import * as Primitivo from "@radix-ui/react-popover";
import type { ComponentProps } from "react";

import { cn } from "../../lib/cn";

/**
 * Popover — emoji picker, reaction picker, seletor de status.
 *
 * Diferente do dropdown em uma coisa que importa: o conteúdo é interativo e
 * pode ser grande. Um emoji picker precisa de altura própria e de scroll
 * interno, e precisa saber quanto espaço sobrou até a borda do viewport — daí
 * `--radix-popover-content-available-height` em vez de uma altura chutada que
 * corta em telas baixas.
 */

export const Popover = Primitivo.Root;
export const PopoverTrigger = Primitivo.Trigger;
export const PopoverClose = Primitivo.Close;
export const PopoverAnchor = Primitivo.Anchor;

export function PopoverContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitivo.Content>) {
  return (
    <Primitivo.Portal>
      <Primitivo.Content
        sideOffset={6}
        collisionPadding={8}
        {...props}
        className={cn(
          "z-flutuante rounded-4 border border-border-subtle bg-surface-4 p-12 shadow-e2",
          "text-md text-text-1",
          "max-h-(--radix-popover-content-available-height) overflow-y-auto",
          "data-[state=closed]:opacity-0 data-[state=open]:opacity-100 anim-fast",
          className,
        )}
      >
        {children}
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}
