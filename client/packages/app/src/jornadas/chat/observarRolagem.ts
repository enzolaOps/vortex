import { observeElementOffset, type Virtualizer } from "@tanstack/react-virtual";

/**
 * `observeElementOffset` do TanStack Virtual, com o fim da rolagem lido NA HORA.
 *
 * ⚠ **O padrão relata uma posição velha.** Sem `scrollend`, o virtualizador marca o fim da
 * rolagem com um `setTimeout` de 150ms rearmado a cada `scroll`, e esse relógio reporta o
 * `scrollTop` guardado no ÚLTIMO evento — não o atual. Com a CPU disputada um quadro passa de
 * 150ms, e o relógio dispara entre uma escrita programática (`scrollToIndex`) e o `scroll` que
 * ela vai gerar: o virtualizador adota a posição de antes da escrita, a próxima compensação de
 * medida (`applyScrollAdjustment`) escreve ESSA posição de volta no DOM, e a reconciliação do
 * salto não corrige, porque ela só reescreve quando o ALVO muda — e o alvo estimado de uma
 * linha não medida não muda.
 *
 * Foi o salto até uma mensagem antiga parando sempre no mesmo `scrollTop` (o fim da lista
 * antes de o histórico ser carregado) com o destino fora da janela montada, só no Linux do CI
 * com vários arquivos de navegador em paralelo. Aqui, o aviso de "parou" relê o elemento:
 * entre eventos, a verdade é o DOM.
 */
export function observarRolagem<T extends Element>(
  instancia: Virtualizer<T, Element>,
  avisar: (posicao: number, rolando: boolean) => void,
): ReturnType<typeof observeElementOffset> {
  return observeElementOffset(instancia, (posicao, rolando) => {
    const el = instancia.scrollElement;
    if (rolando || el === null) {
      avisar(posicao, rolando);
      return;
    }
    const { horizontal, isRtl } = instancia.options;
    avisar(horizontal ? el.scrollLeft * (isRtl ? -1 : 1) : el.scrollTop, false);
  });
}
