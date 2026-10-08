import { alternarReacao } from "nucleo/sdk/adapter";
import { registrarEmojiRecente } from "nucleo/store/emojisRecentes";
import {
  assinarSeletorDeReacao,
  fecharSeletorDeReacao,
  lerAlvoDaReacao,
} from "nucleo/store/seletorDeReacao";
import { useSyncExternalStore, type ReactNode } from "react";

import { chat } from "../../../textos";
import { AncoraDoPopover, ConteudoDoPopover, Popover } from "../../../ui/primitivos/Flutuantes";
import css from "./Emoji.module.css";
import { PainelPreguicoso } from "./PainelPreguicoso";

/**
 * O seletor de emoji para REAGIR: um só para a lista inteira.
 *
 * Aberto pelo store `seletorDeReacao`, que guarda o retângulo do botão que o
 * pediu (a barra de ações ou o menu). A âncora é um `span` fixo nesse
 * retângulo — um popover por linha seria uma árvore de primitivo montada em
 * toda mensagem, na velocidade do scroll, para algo que ninguém abriu.
 */
export function SeletorDeReacao() {
  const alvo = useSyncExternalStore(assinarSeletorDeReacao, lerAlvoDaReacao);

  return (
    <Popover
      open={alvo !== null}
      onOpenChange={(aberto) => {
        if (!aberto) fecharSeletorDeReacao();
      }}
    >
      {alvo !== null && (
        <AncoraDoPopover asChild>
          <span
            aria-hidden="true"
            className={css.ancora}
            style={{ insetInlineStart: alvo.x, insetBlockStart: alvo.y, inlineSize: alvo.largura, blockSize: alvo.altura }}
          />
        </AncoraDoPopover>
      )}
      <ConteudoDoPopover
        aria-label={chat.emoji.seletor}
        className={css.caixa}
        side="bottom"
        align="end"
        collisionPadding={8}
      >
        {alvo !== null && (
          <PainelPreguicoso
            aoEscolher={(glifo) => {
              registrarEmojiRecente(glifo);
              alternarReacao(alvo.messageId, glifo);
              fecharSeletorDeReacao();
            }}
          />
        )}
      </ConteudoDoPopover>
    </Popover>
  );
}

/**
 * O seletor do COMPOSER: ancorado no composer inteiro, abre acima dele.
 * `children` é o composer; o consumidor controla `aberto`.
 */
export function SeletorNoComposer({
  aberto,
  aoMudar,
  aoEscolher,
  aoFechar,
  children,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  aoEscolher: (glifo: string) => void;
  /** Devolve o foco ao campo: sem gatilho, o Radix não sabe para onde voltar. */
  aoFechar: () => void;
  children: ReactNode;
}) {
  return (
    <Popover open={aberto} onOpenChange={aoMudar}>
      <AncoraDoPopover asChild>{children}</AncoraDoPopover>
      <ConteudoDoPopover
        aria-label={chat.emoji.seletor}
        className={css.caixa}
        side="top"
        align="end"
        collisionPadding={8}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          aoFechar();
        }}
        onInteractOutside={(e) => {
          // O botão de emoji do campo também FECHA: sem isto o clique fora fecha e o clique reabre.
          if (e.target instanceof Element && e.target.closest("[data-gatilho-de-emoji]")) e.preventDefault();
        }}
      >
        <PainelPreguicoso aoEscolher={aoEscolher} />
      </ConteudoDoPopover>
    </Popover>
  );
}
