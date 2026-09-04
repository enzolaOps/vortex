import { useSyncExternalStore } from "react";

import { Popover, PopoverAnchor, PopoverContent } from "../components/ui/Popover";
import { alternarReacao } from "../sdk/adapter";
import { SeletorDeEmoji } from "../seletores/SeletorDeEmoji";
import {
  assinarSeletorDeReacao,
  fecharSeletorDeReacao,
  lerAlvoDaReacao,
} from "../store/seletorDeReacao";

/**
 * O seletor de emoji para reagir — UM para a lista inteira.
 *
 * ⚠ **Mora aqui e não na linha**, e é a mesma economia do menu de contexto: a
 * barra de ações e o "＋" da fileira de reações são montados em TODA linha, e
 * um `Popover.Root` em cada seria o custo que aquele A/B já mediu. A linha só
 * diz quem é e onde está; quem monta a árvore é a lista, uma vez.
 *
 * ⚠ **Ancorado a um retângulo e não ao elemento.** O virtualizador desmonta a
 * linha ao rolar, e uma referência de DOM deixaria o Radix posicionando um
 * painel contra um nó fora da árvore — em (0,0), sem erro nenhum. O
 * `PopoverAnchor` é uma caixa de tamanho zero `fixed` nas coordenadas
 * guardadas, que é a mesma técnica que o Radix usa para âncora virtual.
 */
export function SeletorDeReacaoDaLista() {
  const alvo = useSyncExternalStore(assinarSeletorDeReacao, lerAlvoDaReacao);

  return (
    /*
      ⚠ **`key` pelo alvo, e foi medido em navegador.** O `PopoverAnchor` é UM
      nó persistente cujo `left/top` muda; o Floating UI mede a referência na
      abertura e nos eventos de scroll/resize, e não observa mutação de estilo
      inline. Trocar de alvo com o painel ABERTO deixava o seletor parado no
      lugar do chip anterior — medido: âncora em (1258, 254) e painel ainda em
      (860, −1234), a posição do clique de antes.

      Fechar por fora resolve o caminho comum (Radix fecha no clique de fora),
      mas não o do menu de contexto, que pode trocar o alvo sem fechar. O
      `key` remonta e o Floating UI remede — uma linha contra uma classe
      inteira de obsolescência.
    */
    <Popover
      key={alvo?.messageId ?? "vazio"}
      open={alvo !== null}
      onOpenChange={(v) => {
        if (!v) fecharSeletorDeReacao();
      }}
    >
      <PopoverAnchor
        style={{
          position: "fixed",
          left: alvo?.x ?? 0,
          top: alvo?.y ?? 0,
          width: alvo?.largura ?? 0,
          height: alvo?.altura ?? 0,
          /* Não intercepta clique: é uma âncora, não um alvo. Sem isto ela
             cobriria o chip que a abriu e o segundo clique não fecharia. */
          pointerEvents: "none",
        }}
        aria-hidden
      />
      {alvo !== null ? (
        <PopoverContent side="top" align="end" sideOffset={6}>
          <SeletorDeEmoji
            aoEscolher={(glifo) => {
              alternarReacao(alvo.messageId, glifo);
              /*
                Fecha ao escolher — o mesmo contrato do composer, e aqui é
                ainda mais claro: reagir duas vezes seguidas com emojis
                diferentes é raro, e o painel cobre a conversa.
              */
              fecharSeletorDeReacao();
            }}
          />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}
