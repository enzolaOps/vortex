import * as Primitivo from "@radix-ui/react-tooltip";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * Tooltip.
 *
 * O Provider fica na raiz do app, não por tooltip: ele coordena o atraso
 * compartilhado — o primeiro tooltip espera, os seguintes abrem na hora
 * enquanto o ponteiro segue na mesma região. Um Provider por tooltip
 * devolveria o atraso cheio a cada ícone da barra, que é o comportamento
 * irritante que todo mundo reconhece e ninguém sabe nomear.
 */
export const TooltipProvider = Primitivo.Provider;

export function Tooltip({
  texto,
  children,
  lado = "top",
  ...props
}: {
  texto: ReactNode;
  children: ReactNode;
  lado?: ComponentProps<typeof Primitivo.Content>["side"];
} & Omit<ComponentProps<typeof Primitivo.Root>, "children">) {
  return (
    <Primitivo.Root {...props}>
      <Primitivo.Trigger asChild>{children}</Primitivo.Trigger>
      <Primitivo.Portal>
        <Primitivo.Content
          side={lado}
          sideOffset={6}
          className={cn(
            "z-50 rounded-2 border border-border-subtle bg-surface-3 px-2 py-1",
            "text-xs text-text-1",
            // Movimento explica de onde a coisa veio; não chama atenção.
            // 120ms, só opacity — e nada sob prefers-reduced-motion.
            "anim-fast",
          )}
        >
          {texto}
          <Primitivo.Arrow className="fill-surface-3" />
        </Primitivo.Content>
      </Primitivo.Portal>
    </Primitivo.Root>
  );
}
