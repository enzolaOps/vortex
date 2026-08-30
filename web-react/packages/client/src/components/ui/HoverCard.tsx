import * as Primitivo from "@radix-ui/react-hover-card";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";
import css from "./HoverCard.module.css";

/**
 * Hover card — preview de perfil ao passar sobre avatar ou nome.
 *
 * Um dos três primitivos que o Base UI ainda não tem, e um dos que este app
 * mais usa: numa lista de chat, todo avatar e todo nome de usuário é um
 * gatilho.
 *
 * Não é tooltip. O tooltip descreve um controle em uma linha e fecha ao sair;
 * o hover card carrega conteúdo que a pessoa pode querer alcançar com o
 * ponteiro — por isso o atraso de fechamento é maior que o de abertura, senão
 * o card foge no caminho até ele.
 */

export const HoverCard = Primitivo.Root;
export const HoverCardTrigger = Primitivo.Trigger;

export function HoverCardContent({
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
          css.cartao,
          "z-flutuante rounded-12 border border-hairline-10 bg-surface-4 p-12 shadow-e2",
          "text-md text-text-1",
          "data-[state=closed]:opacity-0 data-[state=open]:opacity-100 anim-fast",
          className,
        )}
      >
        {children}
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}

/**
 * Atrasos padrão do produto, num lugar só.
 *
 * 500ms para abrir evita que o card pisque enquanto o ponteiro atravessa a
 * lista; 200ms para fechar dá tempo de o ponteiro chegar no card.
 */
export function PerfilHoverCard({
  gatilho,
  children,
}: {
  gatilho: ReactNode;
  children: ReactNode;
}) {
  return (
    <HoverCard openDelay={500} closeDelay={200}>
      <HoverCardTrigger asChild>{gatilho}</HoverCardTrigger>
      <HoverCardContent>{children}</HoverCardContent>
    </HoverCard>
  );
}
