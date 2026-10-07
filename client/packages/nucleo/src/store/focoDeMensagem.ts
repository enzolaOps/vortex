/**
 * Qual linha carrega a parada de tabulação da lista.
 *
 * Existe porque nenhuma ação de mensagem era alcançável por teclado. O
 * `<article>` não tinha `tabIndex`, a barra de ações é `visibility: hidden` de
 * propósito, e o menu só abria por `onContextMenu` — então responder, reagir,
 * fixar, copiar e editar eram exclusivamente de ponteiro, num app cuja tese é
 * que o teclado é a navegação primária. Não era degradação, era ausência.
 *
 * **Roving tabindex, e o custo é o ponto.** A justificativa registrada ao lado
 * da barra de ações — "com opacidade zero seriam cinquenta mil paradas de
 * tabulação" — está certa para a barra e foi aplicada a um problema que ela não
 * cobre. Uma linha por vez tem `tabIndex=0` e todas as outras `-1`: a lista
 * inteira custa UMA parada, não dez mil.
 *
 * Store module-level e não Context, pela lei nº 1, e pelo mesmo motivo de
 * `menuDeMensagem`: o foco muda a cada seta, e um Context com esse valor
 * re-renderizaria a lista a cada tecla. Aqui acordam duas linhas — a que era
 * foco e a que passou a ser.
 */

let foco: string | null = null;

/**
 * O contador que separa "mover o foco" de "receber o foco".
 *
 * Sem ele o virtualizador rouba o cursor: a linha desmonta e remonta na
 * velocidade do scroll, e uma linha que chama `.focus()` toda vez que monta
 * arranca o foco de quem estiver digitando, a cada reciclagem. Com o contador,
 * `.focus()` só acontece uma vez por pedido de TECLADO — a remontagem vê um
 * pedido já consumido e não faz nada.
 *
 * Começa em 1 e não em 0 porque zero é o valor que a linha lê como "não sou a
 * parada de tabulação"; uma linha que adota o foco por clique precisa de um
 * sinal positivo sem que ninguém tenha pedido movimento.
 */
let pedido = 1;
let consumido = 1;

const ouvintes = new Set<() => void>();

export function assinarFocoDeMensagem(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * O sinal daquela linha: `0` se ela não é a parada de tabulação, senão o número
 * do pedido vigente.
 *
 * Um número e não um objeto — armadilha nº 1 do briefing. E um número em vez de
 * um booleano porque a linha precisa acordar também quando o PEDIDO muda com o
 * id igual: voltar para a lista na mesma linha em que se saiu tem que devolver
 * o cursor, e um booleano `true → true` não notifica ninguém.
 */
export function lerSinalDeFoco(id: string): number {
  return foco === id ? pedido : 0;
}

/** Quem está com a parada de tabulação, para a lista calcular o vizinho. */
export function lerFocoDeMensagem(): string | null {
  return foco;
}

function publicar(novo: string | null) {
  if (foco === novo) return;
  foco = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * A pessoa pediu movimento — seta, Home, End, ou entrar na lista.
 *
 * Incrementa o pedido, e é isso que autoriza a linha a chamar `.focus()`. O
 * incremento acontece mesmo quando o id não muda, porque reentrar na lista pela
 * mesma linha é um pedido legítimo de cursor.
 */
export function moverFocoDeMensagem(id: string): void {
  pedido += 1;
  if (foco === id) {
    for (const ouvinte of ouvintes) ouvinte();
    return;
  }
  publicar(id);
}

/**
 * A linha recebeu o foco por conta própria — clique, ou Tab vindo de fora.
 *
 * NÃO incrementa o pedido: o cursor já está lá, e mandar `.focus()` de volta
 * para onde ele já está é no-op na melhor hipótese e briga com o navegador na
 * pior. O que isto faz é mover a parada de tabulação para acompanhar.
 */
export function adotarFocoDeMensagem(id: string): void {
  publicar(id);
}

/**
 * A linha já usou este pedido?
 *
 * Global e não por instância de componente: a linha remonta a cada reciclagem
 * do virtualizador, e um contador que morre com o componente reautorizaria o
 * roubo de foco em toda remontagem — exatamente o bug que o contador existe
 * para evitar.
 */
export function consumirPedidoDeFoco(sinal: number): boolean {
  if (sinal <= consumido) return false;
  consumido = sinal;
  return true;
}

/** Trocou de canal: a lista é outra, e o id guardado não existe mais nela. */
export function limparFocoDeMensagem(): void {
  foco = null;
  pedido = 1;
  consumido = 1;
  for (const ouvinte of ouvintes) ouvinte();
}
