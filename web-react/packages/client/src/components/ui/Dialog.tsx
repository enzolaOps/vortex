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
  rodape,
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
   *
   * ⚠ Ele também dispensa as TRÊS FAIXAS abaixo: com o conteúdo sendo o
   * próprio cabeçalho, um cabeçalho com respiro em volta seria uma faixa
   * vazia de 44px no topo. Os quatro consumidores que o passam hoje são
   * exatamente os que não têm cabeçalho — paleta, lightbox, encaminhar e
   * enquete.
   */
  tituloOculto?: boolean;
  /**
   * A faixa do rodapé, tipicamente os botões de ação.
   *
   * ⚠ Ela é uma FAIXA e não um `div` no fim do conteúdo: no design ela sangra
   * até a borda do painel, com régua em cima e `surface-1` de fundo — um
   * degrau ABAIXO do painel, não acima. É o que a separa do conteúdo sem
   * gastar uma linha em branco, e é o que mantém os botões visíveis quando o
   * corpo rola.
   */
  rodape?: ReactNode;
}) {
  return (
    <Primitivo.Portal>
      <Primitivo.Overlay
        className={cn(
          css.veu,
          "z-flutuante bg-scrim",
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
          /*
            ⚠ **O painel NÃO tem respiro, e as três faixas abaixo têm o
            seu.** Ele carregava `p-24`, e isso impedia o rodapé de sangrar
            até a borda — o defeito está registrado: dois modais já o
            contornavam com `p-0` à mão. `overflow-hidden` é o que faz o raio
            de 12 recortar a faixa; `flex-col` com o corpo em `min-h-0` é o
            que deixa o CORPO rolar em vez do painel inteiro, mantendo
            cabeçalho e rodapé parados.
          */
          "z-flutuante flex flex-col overflow-hidden",
          "rounded-12 border border-hairline-10 bg-surface-4 shadow-e3",
          "anim-base",
          className,
        )}
      >
        {tituloOculto ? (
          <>
            <Primitivo.Title className="sr-only">{titulo}</Primitivo.Title>
            {descricao ? (
              <Primitivo.Description className="sr-only">
                {descricao}
              </Primitivo.Description>
            ) : null}
            {children}
          </>
        ) : (
          <>
            {/* `16px 18px 12px`, do design. O respiro de baixo é menor porque
                o corpo logo abaixo traz o próprio. */}
            <div className="flex-none px-18 pt-16 pb-12">
              <Primitivo.Title className="text-xl leading-title font-semibold text-text-1">
                {titulo}
              </Primitivo.Title>
              {descricao ? (
                <Primitivo.Description className="mt-02 text-sm text-text-3">
                  {descricao}
                </Primitivo.Description>
              ) : null}
            </div>

            <div className={cn(css.corpo, "flex-1 overflow-y-auto px-18 pb-16")}>
              {children}
            </div>

            {rodape ? (
              <div className="flex flex-none items-center justify-end gap-08 border-t border-hairline-06 bg-surface-1 px-18 py-14">
                {rodape}
              </div>
            ) : null}
          </>
        )}
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}
