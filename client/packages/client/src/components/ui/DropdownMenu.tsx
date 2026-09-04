import * as Primitivo from "@radix-ui/react-dropdown-menu";
import type { ComponentProps, ReactNode } from "react";

import { Check } from "./icones";

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

/**
 * Item que ALTERNA, e continua sendo item de menu.
 *
 * ⚠ **`CheckboxItem` do Radix e não um `Interruptor` embrulhado**, e a razão é
 * o papel de acessibilidade: dentro de um `menu`, o filho precisa ser
 * `menuitemcheckbox` para o leitor de tela anunciar "marcado". Um botão com
 * `aria-pressed` ali dentro quebra a árvore do menu, e o Radix perde a
 * navegação por seta junto.
 *
 * ⚠ **Não fecha ao escolher** (`preventDefault` no `onSelect`): estes itens são
 * preferências que se ajustam juntas — o design põe "Mostrar todos os canais"
 * e "Ocultar canais silenciados" lado a lado —, e fechar o menu a cada clique
 * obrigaria a reabri-lo para a segunda.
 *
 * A marca fica no FIM e não no início: ela é estado, e alinhar o texto de
 * todos os itens do menu vale mais que alinhar as marcas entre si.
 */
export function DropdownMenuCheckboxItem({
  className,
  children,
  marcado,
  aoAlternar,
  ...props
}: Omit<
  ComponentProps<typeof Primitivo.CheckboxItem>,
  "checked" | "onCheckedChange" | "onSelect"
> & {
  marcado: boolean;
  aoAlternar: () => void;
}) {
  return (
    <Primitivo.CheckboxItem
      {...props}
      checked={marcado}
      onSelect={(e) => {
        e.preventDefault();
        aoAlternar();
      }}
      className={cn(menuItem, menuItemNormal, className)}
    >
      {children}
      <span className="ms-auto ps-16 flex w-12">
        {marcado ? <Check size={12} aria-hidden /> : null}
      </span>
    </Primitivo.CheckboxItem>
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
