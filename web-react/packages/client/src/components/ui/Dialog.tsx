import * as Primitivo from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * Dialog.
 *
 * O caso mais claro de "biblioteca resolve o genérico": foco preso enquanto
 * aberto, foco devolvido ao gatilho no fechamento, Esc, clique fora,
 * `aria-modal`, e o resto da árvore marcado como inerte. Escrever isso à mão é
 * caro e termina com acessibilidade quebrada em algum caminho de teclado.
 *
 * ⚠ O Radix trava o scroll ao abrir overlay (react-remove-scroll). Isso
 * interage com a lista virtualizada: abrir um diálogo sobre o histórico não
 * pode perder a âncora nem provocar salto ao fechar. É o tipo de bug que só
 * aparece com histórico longo carregado — o firehose com 10k é onde se testa.
 */

export const Dialog = Primitivo.Root;
export const DialogTrigger = Primitivo.Trigger;
export const DialogClose = Primitivo.Close;

export function DialogContent({
  titulo,
  descricao,
  tituloOculto = false,
  className,
  children,
  ...props
}: ComponentProps<typeof Primitivo.Content> & {
  titulo: ReactNode;
  /** Some visualmente, mas o leitor de tela anuncia. */
  descricao?: ReactNode;
  /**
   * Título só para leitor de tela.
   *
   * Existe para o diálogo cujo PRÓPRIO conteúdo já é o cabeçalho — a paleta
   * de comandos abre com um campo de busca em corpo grande, e um "Buscar"
   * acima dele seria a mesma palavra duas vezes ocupando uma linha.
   *
   * O título continua existindo no DOM: `Dialog.Title` é o que o leitor de
   * tela anuncia ao abrir, e um diálogo sem ele é anunciado como "diálogo" e
   * mais nada. Esconder não é remover.
   */
  tituloOculto?: boolean;
}) {
  return (
    <Primitivo.Portal>
      <Primitivo.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-surface-0/70",
          // Sem backdrop-filter: custa GPU continuamente, não só na transição,
          // e isto é painel de produtividade aberto o dia inteiro.
          "anim-base",
        )}
      />
      <Primitivo.Content
        {...props}
        className={cn(
          // Centralizado por margem automática, não por `left-1/2` mais
          // translate: o idioma clássico assume lado, e a lei nº 6 diz que
          // nada pode. `inset-x-0` é simétrico, então não escolhe direção.
          "fixed top-1/2 inset-x-0 z-50 mx-auto w-full max-w-lg -translate-y-1/2",
          "rounded-3 border border-border-subtle bg-surface-2 p-5",
          "anim-base",
          className,
        )}
      >
        <Primitivo.Title
          className={cn(
            tituloOculto
              ? "sr-only"
              : "text-lg leading-title font-medium text-text-1",
          )}
        >
          {titulo}
        </Primitivo.Title>

        {descricao ? (
          <Primitivo.Description className="mt-1 text-md text-text-2">
            {descricao}
          </Primitivo.Description>
        ) : (
          /* O Radix avisa em dev se o Content não tem Description. Quando não
             há texto de apoio, a descrição existe só para o leitor de tela. */
          <Primitivo.Description className="sr-only">{titulo}</Primitivo.Description>
        )}

        <div className={tituloOculto ? undefined : "mt-4"}>{children}</div>
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}
