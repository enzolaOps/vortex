import * as Primitivo from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";
import css from "./Dialog.module.css";

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
          css.veu,
          "z-flutuante bg-surface-0/70",
          // Sem backdrop-filter: custa GPU continuamente, não só na transição,
          // e isto é painel de produtividade aberto o dia inteiro.
          "anim-base",
        )}
      />
      <Primitivo.Content
        {...props}
        /*
          ⚠ **Sem descrição, `aria-describedby` é REMOVIDO — não preenchido com
          o título.**

          A versão anterior renderizava uma `Description` sr-only com o mesmo
          texto do título, para calar o aviso do Radix. O efeito era o leitor de
          tela anunciar "Editar canal, Editar canal": o título e, logo em
          seguida, a descrição, que era a mesma frase.

          `undefined` explícito é a escotilha documentada do Radix justamente
          para isto — diálogo sem texto de apoio não tem descrição, e inventar
          uma repetindo o título é pior que não ter, porque soa como erro de
          leitura para quem depende dela.

          Espalhado e CONDICIONAL: passar `aria-describedby={undefined}` sempre
          sobrescreveria o que o Radix liga quando existe `Description`, e aí o
          diálogo COM texto de apoio perderia a descrição — o defeito inverso,
          e mais difícil de ver.
        */
        {...(descricao ? {} : { "aria-describedby": undefined })}
        className={cn(
          css.painel,
          "z-flutuante rounded-3 border border-border-strong bg-surface-2 p-5",
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
        ) : null}

        <div className={tituloOculto ? undefined : "mt-4"}>{children}</div>
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}
