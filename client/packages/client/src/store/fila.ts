/**
 * As pendentes que a pessoa JÁ decidiu manter na fila.
 *
 * ⚠ **A decisão é o dado, e por isso ela existe.** "Enviar quando voltar" é o
 * que aconteceria de qualquer jeito — o valor do botão não é mudar o
 * comportamento, é DISPENSAR a pergunta. Sem guardar a escolha, as duas ações
 * ficariam na linha para sempre, e o design as desenha como uma decisão que se
 * toma uma vez.
 *
 * ⚠ **Store com assinatura, e NÃO um `Set` solto lido no render.** A primeira
 * versão era um `Set` no adapter, republicando o snapshot da mensagem para
 * acordar a linha — e não acordava: o snapshot é cacheado por conteúdo e
 * estado, e nenhum dos dois muda quando a escolha muda. A linha continuava
 * mostrando os dois botões depois do clique, sem erro nenhum. É a armadilha
 * nº 1 do briefing pela porta dos fundos: a fonte da verdade tinha de ser
 * observável, e não era.
 *
 * `useSyncExternalStore` sobre um BOOLEANO por ID: a linha compara por valor e
 * descarta o render quando nada mudou. Só as pendentes assinam, e pendente é
 * caso raro por construção.
 */

const confirmadas = new Set<string>();
const ouvintes = new Set<() => void>();

export function assinarFila(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function confirmadaNaFila(id: string): boolean {
  return confirmadas.has(id);
}

export function confirmarNaFila(id: string): void {
  if (confirmadas.has(id)) return;
  confirmadas.add(id);
  for (const o of ouvintes) o();
}

/**
 * Esquece a decisão.
 *
 * Chamado ao descartar e ao reenviar: em nenhum dos dois casos a mensagem
 * continua na fila, e uma entrada que sobra é vazamento — o erro nº 5 do
 * briefing na sua forma mais barata de evitar.
 */
export function esquecerDaFila(id: string): void {
  if (!confirmadas.delete(id)) return;
  for (const o of ouvintes) o();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparFila(): void {
  confirmadas.clear();
}
