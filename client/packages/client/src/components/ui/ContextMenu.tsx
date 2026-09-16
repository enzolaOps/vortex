import {
  CaretRight,
  Check,
  ICONE,
} from "./icones";
import * as Primitivo from "@radix-ui/react-context-menu";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";
import {
  menuContent,
  menuItem,
  menuItemAviso,
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
  aviso,
  ...props
}: ComponentProps<typeof Primitivo.Item> & { perigo?: boolean; aviso?: boolean }) {
  return (
    <Primitivo.Item
      {...props}
      className={cn(menuItem, tomDoItem(perigo, aviso), className)}
    />
  );
}

/**
 * ⚠ **Aviso é o terceiro tom, e ele não é um perigo mais fraco.** O design
 * pinta "Mudo no servidor" e "Ensurdecer no servidor" em âmbar e "Desconectar
 * do canal" em vermelho, no mesmo bloco: restringir alguém é reversível e
 * administrativo, tirá-lo da sala é uma ação que interrompe. É a mesma
 * distinção do selo `SRV` na linha da sala.
 */
function tomDoItem(perigo?: boolean, aviso?: boolean): string {
  if (perigo) return menuItemPerigo;
  if (aviso) return menuItemAviso;
  return menuItemNormal;
}

/**
 * Item que ALTERNA — o par do `DropdownMenuCheckboxItem`, e pela mesma razão:
 * dentro de um `menu` o leitor de tela precisa de `menuitemcheckbox` para
 * anunciar "marcado", e um rótulo que alternasse com o estado faria quem lê
 * depressa clicar no oposto do que quer.
 *
 * Não fecha ao escolher: a marca mudando É a confirmação.
 */
export function ContextMenuCheckboxItem({
  className,
  children,
  marcado,
  aoAlternar,
  aviso,
  ...props
}: Omit<
  ComponentProps<typeof Primitivo.CheckboxItem>,
  "checked" | "onCheckedChange" | "onSelect"
> & {
  marcado: boolean;
  aoAlternar: () => void;
  aviso?: boolean;
}) {
  return (
    <Primitivo.CheckboxItem
      {...props}
      checked={marcado}
      onSelect={(e) => {
        e.preventDefault();
        aoAlternar();
      }}
      className={cn(menuItem, tomDoItem(false, aviso), className)}
    >
      {children}
      <span className="ms-auto ps-16 flex w-12">
        {marcado ? <Check size={12} aria-hidden /> : null}
      </span>
    </Primitivo.CheckboxItem>
  );
}

/**
 * Submenu.
 *
 * ⚠ **O `›` já existiu na tela sem isto por trás, e foi removido por causa
 * disso.** "Cargos" e "Mover para canal" tinham a seta e nada abria — o
 * defeito que o lint de `onSelect` existe para matar, na forma mais cara:
 * um alvo que ANUNCIA um caminho e não tem. A seta volta com o mecanismo, não
 * antes dele.
 *
 * O conteúdo reusa `menuContent` e `menuItem`: um submenu com caixa própria
 * seria a mesma superfície escrita duas vezes, e a primeira a mudar deixaria
 * as duas diferentes.
 */
export const ContextMenuSub = Primitivo.Sub;

export function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof Primitivo.SubTrigger>) {
  return (
    <Primitivo.SubTrigger
      {...props}
      className={cn(menuItem, menuItemNormal, className)}
    >
      {children}
      {/* A seta na ponta, e o `ms-auto` é o que a empurra: sem ela o item não
          se distingue de um que executa ao clicar.

          ⚠ `size={ICONE.selo}` na prop e não `size-3` na classe: o `@theme` faz
          `--spacing-*: initial`, então utility computada sobre a base do
          Tailwind não é emitida — o `pnpm utilities` pegou na primeira
          corrida. */}
      <CaretRight size={ICONE.selo} className="ms-auto text-text-4" aria-hidden />
    </Primitivo.SubTrigger>
  );
}

export function ContextMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof Primitivo.SubContent>) {
  return (
    <Primitivo.Portal>
      <Primitivo.SubContent
        {...props}
        /* `sideOffset` pequeno: o submenu encosta no pai, como no design —
           afastado, o ponteiro atravessa o vão e o menu fecha no caminho. */
        sideOffset={2}
        className={cn(menuContent, className)}
      />
    </Primitivo.Portal>
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
