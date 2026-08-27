/**
 * Qual linha o menu de contexto está mirando.
 *
 * Existe para que haja **um** `ContextMenu` do Radix na lista inteira em vez de
 * um por linha. Cada `MessageRow` montava Root, Trigger, Portal e Content, e
 * linha monta e desmonta na velocidade do scroll — trinta árvores de menu
 * sendo criadas e destruídas por segundo enquanto ninguém abriu menu nenhum.
 *
 * Store module-level e não Context, pela lei nº 1: o alvo muda a cada clique
 * direito, e um Context com esse valor re-renderizaria a lista inteira a cada
 * mudança. Aqui quem acorda são as duas linhas envolvidas — a que era alvo e a
 * que passou a ser.
 */

let alvo: string | null = null;

const ouvintes = new Set<() => void>();

export function assinarMenuDeMensagem(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: uma string ou `null`, comparados por valor. */
export function lerAlvoDoMenu(): string | null {
  return alvo;
}

/**
 * Quem vai receber o menu.
 *
 * A ordem importa e é o que faz isto funcionar sem estado obsoleto: o
 * container limpa o alvo na fase de CAPTURA e a linha escreve o seu na fase de
 * bolha. Clique direito em cima de uma linha passa pelos dois e termina com o
 * id certo; clique direito no vão entre linhas passa só pelo primeiro e
 * termina em `null`, que é a resposta honesta — não há mensagem ali.
 *
 * Sem a captura, o menu abriria com o alvo do clique ANTERIOR, e o item
 * "Copiar texto" copiaria a mensagem errada. É o tipo de bug que não dá erro e
 * só aparece quando alguém repara que colou outra coisa.
 */
export function definirAlvoDoMenu(id: string | null): void {
  if (alvo === id) return;
  alvo = id;
  for (const ouvinte of ouvintes) ouvinte();
}
