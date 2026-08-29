/**
 * Quem o menu de contexto da lista está mirando.
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
 *
 * ⚠ **O alvo é uma UNIÃO, e não mais só um id de mensagem.** O design tem dois
 * menus na timeline — o da mensagem e o do usuário —, e a alternativa seria um
 * segundo `ContextMenu` em volta do autor de cada linha. Isso desfaria em
 * silêncio a economia que este store inteiro existe para garantir: em vez de
 * uma árvore de menu por linha, duas.
 */

export type AlvoDoMenu =
  | { readonly tipo: "mensagem"; readonly id: string }
  | { readonly tipo: "usuario"; readonly userId: string };

/**
 * O objeto GUARDADO, e é ele que sai da leitura.
 *
 * Montar `{ tipo, id }` dentro do getter seria a armadilha nº 1 do briefing na
 * sua forma mais fácil de escrever sem perceber: referência nova a cada
 * leitura, `useSyncExternalStore` concluindo que mudou, e loop de render.
 */
let alvo: AlvoDoMenu | null = null;

const ouvintes = new Set<() => void>();

export function assinarMenuDeMensagem(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: o objeto guardado, nunca um recém-montado. */
export function lerAlvoDoMenu(): AlvoDoMenu | null {
  return alvo;
}

/**
 * A mensagem alvo, ou `null` quando o alvo é outra coisa.
 *
 * Atalho para o caso mais comum — a linha perguntando "sou eu?" —, e ele
 * devolve uma STRING de propósito: é o que faz a subscrição da linha ser
 * comparada por valor em vez de por referência.
 */
export function alvoDeMensagem(): string | null {
  return alvo?.tipo === "mensagem" ? alvo.id : null;
}

/**
 * Quem vai receber o menu.
 *
 * A ordem importa e é o que faz isto funcionar sem estado obsoleto: o
 * container limpa o alvo na fase de CAPTURA e a linha escreve o seu na fase de
 * bolha. Clique direito em cima de uma linha passa pelos dois e termina com o
 * alvo certo; clique direito no vão entre linhas passa só pelo primeiro e
 * termina em `null`, que é a resposta honesta — não há mensagem ali.
 *
 * Sem a captura, o menu abriria com o alvo do clique ANTERIOR, e o item
 * "Copiar texto" copiaria a mensagem errada. É o tipo de bug que não dá erro e
 * só aparece quando alguém repara que colou outra coisa.
 *
 * A comparação é por CAMPO e não por referência: quem chama monta o objeto no
 * handler, então dois cliques na mesma linha produziriam dois objetos
 * diferentes e acordariam a lista à toa.
 */
export function definirAlvoDoMenu(novo: AlvoDoMenu | null): void {
  if (mesmo(alvo, novo)) return;
  alvo = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

function mesmo(a: AlvoDoMenu | null, b: AlvoDoMenu | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.tipo !== b.tipo) return false;
  return a.tipo === "mensagem" && b.tipo === "mensagem"
    ? a.id === b.id
    : a.tipo === "usuario" && b.tipo === "usuario" && a.userId === b.userId;
}
