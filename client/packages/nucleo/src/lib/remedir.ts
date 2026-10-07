/**
 * Remedir um virtualizador SEM voltar às estimativas.
 *
 * ⚠ **`virtualizer.measure()` sozinho apaga as medidas e não mede nada.** No
 * TanStack Virtual ele limpa o `itemSizeCache` e notifica; as linhas montadas
 * só voltam a ser medidas quando o `ResizeObserver` DELAS dispara, ou seja,
 * quando a caixa da linha muda de tamanho DEPOIS do `measure()`. Quando isso
 * não acontece, toda linha na tela passa a ser posicionada pela ESTIMATIVA
 * enquanto o DOM continua com a altura real — linha maior que a estimativa
 * escreve por cima da seguinte, linha menor abre um buraco.
 *
 * Os dois caminhos em que não acontece, e os dois existem no produto:
 *
 * 1. **Fim de arraste de slot** (`aoTerminarArraste`). Por construção a largura
 *    já foi escrita no DOM durante o arraste — as linhas já se remediram
 *    sozinhas —, e o `measure()` do commit chega depois e apaga o resultado.
 *    `escolherPainel` do modo edição chama o mesmo par sem arraste nenhum.
 * 2. **Ordem dos observadores.** O `ResizeObserver` das linhas é criado quando
 *    a primeira linha monta; o do container, num efeito depois. Na mesma
 *    rodada de layout as linhas se medem PRIMEIRO, e o `measure()` do
 *    container vem em seguida e apaga.
 *
 * Medido no chat da sala de voz a 290px: sistema real 69px contra 48 de
 * estimativa (21px de sobreposição por linha) e "abre grupo" real 56px contra
 * 123 (67px de buraco) — exatamente a captura de quem usa. Na coluna principal
 * o erro é menor porque as estimativas foram medidas numa largura parecida, e
 * foi por isso que o defeito passou despercebido lá.
 *
 * A saída é medir de novo, na hora, o que está montado. `measureElement` com o
 * mesmo nó não re-observa (o TanStack compara com o cache de elementos) e só
 * chama `resizeItem`, que é o caminho que já compensa a rolagem das linhas
 * acima do topo — a âncora continua sendo responsabilidade dele.
 *
 * ⚠ **O `getTotalSize()` do meio é load-bearing.** `resizeItem` calcula o
 * delta contra o tamanho das medições INTERNAS, que o `measure()` não refaz —
 * elas só são recalculadas na próxima leitura. Sem forçar essa leitura, o
 * delta sai zero (a medida velha é igual à real), o cache não é escrito, e o
 * render seguinte recalcula tudo pela estimativa: exatamente o defeito, com a
 * função "consertando" e nada mudando. Achado no navegador; o primeiro teste
 * passava porque não recalculava depois de medir.
 *
 * Nó desconectado fica de fora: `offsetHeight` dele é 0, e medir 0 é a
 * armadilha da linha que mede zero.
 */
export interface Remedivel<E extends Element = Element> {
  measure: () => void;
  measureElement: (node: E | null) => void;
  getTotalSize: () => number;
  elementsCache: Map<unknown, E>;
}

export function remedir<E extends Element>(virtualizer: Remedivel<E>): void {
  // eslint-disable-next-line no-restricted-syntax -- o único dono do `measure()` cru
  virtualizer.measure();
  virtualizer.getTotalSize();
  for (const el of [...virtualizer.elementsCache.values()]) {
    if (el.isConnected) virtualizer.measureElement(el);
  }
}
