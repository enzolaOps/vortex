/**
 * Qual cabeçalho de seção fica grudado no topo — D-APP-39.
 *
 * Função pura e arquivo próprio porque ela é consultada em DOIS lugares que
 * precisam concordar: o `rangeExtractor`, que garante que o índice esteja na
 * janela do virtualizador, e o render, que decide qual linha recebe
 * `position: sticky`. Se os dois divergirem por um índice, o `sticky` cai num
 * elemento que o extrator não montou — e o resultado é um cabeçalho que
 * simplesmente não aparece, sem erro nenhum.
 *
 * Testável sem navegador, que é o que a torna verificável: a outra metade
 * (o `sticky` de fato colando) depende de engine de layout e continua sendo
 * medida à mão, como a âncora da lista de mensagens.
 */

/**
 * O último índice de `secoes` que é `<= alvo`, ou `undefined` se nenhum for.
 *
 * `undefined` e não `-1`: a lista pode começar com membros antes de qualquer
 * cabeçalho, e "não há seção acima" é ausência, não um índice fora de faixa
 * que alguém vai indexar por engano.
 *
 * ⚠ **`<=` e não `<`.** Com `<`, o cabeçalho que está EXATAMENTE no topo da
 * janela não seria o grudado — o de cima seria, e a coluna anunciaria a seção
 * errada no instante em que a nova entra, que é justamente o quadro em que
 * alguém está olhando.
 *
 * `secoes` chega ordenada (ela é derivada da lista de linhas na ordem delas),
 * então basta varrer de trás para frente; são unidades, não milhares.
 */
export function ultimaSecaoAte(
  secoes: readonly number[],
  alvo: number,
): number | undefined {
  for (let i = secoes.length - 1; i >= 0; i -= 1) {
    const indice = secoes[i];
    if (indice !== undefined && indice <= alvo) return indice;
  }
  return undefined;
}
