/**
 * Onde o seletor de reação está aberto.
 *
 * ⚠ **Um seletor para a lista inteira, e não um por chip** — a mesma decisão,
 * pela mesma conta, que tirou o `ContextMenu` da linha e o `Tooltip` da barra
 * de ações. A barra é MONTADA em toda linha (`visibility: hidden`, não
 * desmontada), e o "＋" da fileira de reações também: um `Popover.Root` em cada
 * um seriam duas árvores de primitivo por linha e ~800 com a janela cheia,
 * criadas e destruídas na velocidade do scroll enquanto ninguém abriu nada.
 * Aquele A/B mediu 1,7% → 1,2% de frames perdidos por QUATRO componentes a
 * menos por linha.
 *
 * Store module-level e não Context, pela lei nº 1: o alvo muda a cada clique, e
 * um Context com esse valor re-renderizaria a lista inteira.
 *
 * ⚠ **Guarda o RETÂNGULO e não o elemento.** Uma referência de DOM sobreviveria
 * à linha ser desmontada pelo virtualizador — o seletor ficaria ancorado num nó
 * fora da árvore, e o Radix o posicionaria em (0,0). O retângulo é um valor;
 * rolar com o seletor aberto o deixa parado onde foi aberto, que é o que
 * qualquer popover faz.
 */

export type AlvoDaReacao = {
  readonly messageId: string;
  /** Em coordenadas de viewport, como `getBoundingClientRect`. */
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
};

/**
 * O objeto GUARDADO, e é ele que sai da leitura.
 *
 * Montá-lo dentro do getter é a armadilha nº 1 do briefing: referência nova a
 * cada chamada, `useSyncExternalStore` concluindo que mudou, loop de render.
 */
let alvo: AlvoDaReacao | null = null;

const ouvintes = new Set<() => void>();

export function assinarSeletorDeReacao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerAlvoDaReacao(): AlvoDaReacao | null {
  return alvo;
}

/**
 * Abre ancorado a um elemento — o chip, o "＋" ou o botão da barra de ações.
 *
 * Recebe o elemento e mede AQUI, no clique: medir é a única coisa que precisa
 * dele, e fazê-lo na fronteira do store deixa quem chama sem nada a lembrar.
 */
export function abrirSeletorDeReacao(
  messageId: string,
  ancora: Element | null,
): void {
  const r = ancora?.getBoundingClientRect();
  alvo = {
    messageId,
    x: r?.x ?? 0,
    y: r?.y ?? 0,
    largura: r?.width ?? 0,
    altura: r?.height ?? 0,
  };
  for (const o of ouvintes) o();
}

export function fecharSeletorDeReacao(): void {
  if (alvo === null) return;
  alvo = null;
  for (const o of ouvintes) o();
}
