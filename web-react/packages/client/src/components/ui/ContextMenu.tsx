import * as Primitivo from "@radix-ui/react-context-menu";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * Context menu — o primitivo que decidiu a escolha por Radix.
 *
 * Base UI ainda não tem Context Menu, Hover Card nem Toast, que é exatamente o
 * que um cliente de chat mais usa. Seguir o default do shadcn deixaria as três
 * peças mais difíceis para escrever à mão.
 *
 * Aqui o Radix entrega o que é difícil e igual em todo app: roving tabindex,
 * foco devolvido ao lugar certo no Esc, posicionamento contra a borda do
 * viewport, long-press no toque, leitor de tela. Nada disso é específico do
 * Vortex, e escrever à mão é desperdício com a11y quebrada.
 *
 * O estilo é o específico, e é nosso.
 */

export const ContextMenu = Primitivo.Root;
export const ContextMenuTrigger = Primitivo.Trigger;

/**
 * Estado vem por data-attribute, não por classe condicional em JS.
 *
 * Menos re-render, e o estado fica no DOM onde dá para inspecionar. O Radix
 * expõe `data-state`, `data-side`, `data-highlighted` e `data-disabled`; a
 * largura do gatilho e a altura disponível até a borda do viewport vêm como
 * CSS var, então constranger é declarativo em vez de calculado na mão.
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
          "z-50 min-w-48 rounded-2 border border-border-subtle bg-surface-2 p-1",
          "text-md text-text-1",
          // Profundidade por camada, não por sombra: sombra em fundo escuro é
          // quase invisível e custa pintura.
          "max-h-(--radix-context-menu-content-available-height) overflow-y-auto",
          "data-[state=closed]:opacity-0 data-[state=open]:opacity-100",
          "anim-fast",
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
      className={cn(
        "flex cursor-default items-center gap-2 rounded-1 px-2 py-1 outline-none select-none",
        "data-highlighted:bg-surface-3",
        "data-disabled:pointer-events-none data-disabled:text-text-3",
        perigo ? "text-danger data-highlighted:text-danger" : "text-text-2",
        className,
      )}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitivo.Separator>) {
  return (
    <Primitivo.Separator
      {...props}
      className={cn("my-1 h-px bg-border-subtle", className)}
    />
  );
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return (
    <Primitivo.Label className="px-2 py-1 text-xs text-text-3">
      {children}
    </Primitivo.Label>
  );
}
