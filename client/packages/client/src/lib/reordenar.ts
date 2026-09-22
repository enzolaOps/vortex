/**
 * Reordenar uma lista — o miolo que o arraste e o teclado compartilham.
 *
 * ⚠ **Extraído na TERCEIRA cópia, que é a regra do projeto.** O mesmo
 * `splice` de dois passos já estava escrito em `enquete/CriarEnquete.tsx` e em
 * `config/Cargos.tsx`, cada um embrulhado na própria política — otimismo de
 * rede num, hierarquia de cargo no outro. O que NÃO varia entre os três é isto
 * aqui, e é só isto que sai: as políticas ficam onde estão, porque elas é que
 * são diferentes.
 *
 * Trabalha sobre ÍNDICE e não sobre id, de propósito: o `id` das três listas
 * tem forma diferente (string, objeto com `.id`, cargo do protocolo), e um
 * seletor genérico faria o chamador escrever mais do que o `findIndex` que ele
 * já tem. Índice é o que sobra quando se tira a forma do item.
 *
 * As duas funções devolvem a MESMA referência quando nada muda, e isso não é
 * economia: elas alimentam `setState`, e um array novo a cada `dragover` —
 * que o navegador dispara a ~20 Hz com o ponteiro parado — re-renderizaria a
 * lista inteira sem nada ter mudado de lugar.
 */

/** Tira o item de `de` e o põe em `para`. Fora de faixa devolve a lista. */
export function moverItem<T>(
  lista: readonly T[],
  de: number,
  para: number,
): readonly T[] {
  if (de === para) return lista;
  if (de < 0 || para < 0 || de >= lista.length || para >= lista.length) {
    return lista;
  }
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  if (item === undefined) return lista;
  copia.splice(para, 0, item);
  return copia;
}

/**
 * Sobe ou desce uma casa — o caminho de teclado.
 *
 * Ele NÃO circula nas pontas: o primeiro item com `Alt+↑` fica onde está. Uma
 * lista que dá a volta faz quem segura a tecla perder de vista onde o item
 * parou, e "não mexeu" é mais fácil de entender que "foi para o outro lado".
 */
export function empurrarItem<T>(
  lista: readonly T[],
  indice: number,
  passo: number,
): readonly T[] {
  return moverItem(lista, indice, indice + passo);
}
