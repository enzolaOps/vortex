/**
 * Comandos de uma superfície para outra.
 *
 * Enviar uma mensagem com a lista rolada para cima precisa levar a pessoa até o
 * fim — senão ela escreve, aperta Enter e não vê nada acontecer. O
 * `followOnAppend` não resolve isso de propósito: ele só segue quem já estava
 * no fim, que é justamente o comportamento certo para mensagem dos OUTROS.
 *
 * Mas o composer não pode chamar a lista. Lei nº 6: componente não assume o que
 * está ao lado, e na fase 4 os dois podem nem estar no mesmo painel. Então a
 * ligação é a mesma de todo o resto — módulo-level, keyed por canal. Quem manda
 * não sabe quem ouve; se ninguém ouvir, nada acontece.
 *
 * Isto NÃO é estado, é evento, e por isso não passa por `useSyncExternalStore`:
 * não há snapshot a devolver, e modelar evento como estado exigiria um contador
 * monotônico existindo só para o React perceber que aconteceu de novo.
 */

type Ouvinte = () => void;

const ouvintes = new Map<string, Set<Ouvinte>>();

/** Pede à lista daquele canal para voltar ao fim. Sem ouvinte, é no-op. */
export function pedirFimDaLista(channelId: string): void {
  const set = ouvintes.get(channelId);
  if (!set) return;
  for (const ouvinte of set) ouvinte();
}

/** Devolve o cancelamento — é o retorno que o `useEffect` espera. */
export function ouvirFimDaLista(channelId: string, ouvinte: Ouvinte): () => void {
  let set = ouvintes.get(channelId);
  if (!set) {
    set = new Set();
    ouvintes.set(channelId, set);
  }
  set.add(ouvinte);

  return () => {
    const atual = ouvintes.get(channelId);
    if (!atual) return;
    atual.delete(ouvinte);
    // Sem isto, um canal visitado uma vez deixa um Set vazio para sempre. É o
    // erro nº 5 do briefing na sua forma mais barata de evitar.
    if (atual.size === 0) ouvintes.delete(channelId);
  };
}

/* ----------------------------------------------------------- foco no composer */

/**
 * Leva o cursor ao composer daquele canal.
 *
 * Existe para o estado vazio da lista: um canal sem histórico convida a
 * escrever, e o convite tem que LEVAR até lá — botão que só diz "escreva algo"
 * e deixa a pessoa procurar o campo é decoração de estado vazio, não ação.
 *
 * Mesmo barramento de `pedirFimDaLista`, e pela mesma razão: o estado vazio
 * mora dentro da lista e o composer é outro painel — na fase 4 os dois podem
 * nem estar na mesma coluna. Lei nº 6: ninguém alcança o vizinho pelo nome.
 */
const focadores = new Map<string, Set<Ouvinte>>();

export function pedirFocoNoComposer(channelId: string): void {
  const set = focadores.get(channelId);
  if (!set) return;
  for (const ouvinte of set) ouvinte();
}

export function ouvirFocoNoComposer(
  channelId: string,
  ouvinte: Ouvinte,
): () => void {
  let set = focadores.get(channelId);
  if (!set) {
    set = new Set();
    focadores.set(channelId, set);
  }
  set.add(ouvinte);

  return () => {
    const atual = focadores.get(channelId);
    if (!atual) return;
    atual.delete(ouvinte);
    if (atual.size === 0) focadores.delete(channelId);
  };
}
