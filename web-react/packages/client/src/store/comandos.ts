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

/* --------------------------------------------------- longe do fim da lista */

/**
 * A lista daquele canal está longe do fim?
 *
 * ⚠ **Isto É estado, ao contrário dos dois eventos acima** — e por isso passa
 * por `useSyncExternalStore`, com snapshot e emissão. Quem pergunta é o
 * composer, para decidir se mostra "Ir para o presente"; quem responde é a
 * lista, que é a única que sabe onde a rolagem está.
 *
 * ⚠ **Publica só quando MUDA, e a diferença não é estética.** A lista consulta
 * a distância até o fim a cada evento de rolagem — dezenas por segundo. Se
 * cada consulta emitisse, o composer re-renderizaria em toda rolagem, e o
 * composer contém a `textarea` onde alguém está digitando. Escrever o mesmo
 * booleano de novo não emite nada.
 *
 * Keyed por canal pelo mesmo motivo de tudo mais aqui: a lei nº 6 não deixa o
 * composer saber que existe uma lista, quanto mais qual.
 */
const longe = new Map<string, boolean>();
const ouvintesDeLonge = new Map<string, Set<Ouvinte>>();

export function definirLongeDoFim(channelId: string, valor: boolean): void {
  if ((longe.get(channelId) ?? false) === valor) return;
  longe.set(channelId, valor);
  const set = ouvintesDeLonge.get(channelId);
  if (!set) return;
  for (const ouvinte of set) ouvinte();
}

export function lerLongeDoFim(channelId: string): boolean {
  return longe.get(channelId) ?? false;
}

export function assinarLongeDoFim(
  channelId: string,
  ouvinte: Ouvinte,
): () => void {
  let set = ouvintesDeLonge.get(channelId);
  if (!set) {
    set = new Set();
    ouvintesDeLonge.set(channelId, set);
  }
  set.add(ouvinte);

  return () => {
    const atual = ouvintesDeLonge.get(channelId);
    if (!atual) return;
    atual.delete(ouvinte);
    if (atual.size === 0) {
      ouvintesDeLonge.delete(channelId);
      // A resposta some junto com o último ouvinte: uma lista desmontada não
      // tem posição de rolagem, e guardar a última faria o botão reaparecer
      // ao voltar ao canal, sobre uma lista que já está no fim.
      longe.delete(channelId);
    }
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

/* --------------------------------------------------- ir para uma mensagem */

/**
 * Leva a lista até uma mensagem específica.
 *
 * O gatilho é a citação de uma resposta: clicar nela tem que levar ao
 * original, senão a citação é só um texto menor em cinza. Mesmo barramento de
 * `pedirFimDaLista`, e pela mesma razão — quem clica é a LINHA, e a linha não
 * conhece o virtualizador (lei nº 1: ela assina só a si mesma).
 */
const saltadores = new Map<string, Set<(messageId: string) => void>>();

/**
 * O salto que chegou antes de haver lista, guardado.
 *
 * "Sem ouvinte é no-op" era a regra certa enquanto todo pedido nascia de um
 * clique — se ninguém ouve, ninguém pediu. **O permalink quebra essa
 * premissa:** abrir `/servidor/A/canal/B/01MENSAGEM` pede o salto no momento
 * em que a rota é lida, e a lista daquele canal ainda nem montou. Sem esta
 * gaveta o link abriria o canal certo na posição errada, sem erro nenhum.
 *
 * Um por canal, e o último ganha: dois pedidos antes de a lista existir
 * significam que a pessoa trocou de ideia.
 */
const pendentes = new Map<string, string>();

export function pedirIrParaMensagem(channelId: string, messageId: string): void {
  const set = saltadores.get(channelId);
  if (!set || set.size === 0) {
    pendentes.set(channelId, messageId);
    return;
  }
  for (const ouvinte of set) ouvinte(messageId);
}

export function ouvirIrParaMensagem(
  channelId: string,
  ouvinte: (messageId: string) => void,
): () => void {
  let set = saltadores.get(channelId);
  if (!set) {
    set = new Set();
    saltadores.set(channelId, set);
  }
  set.add(ouvinte);

  // Chegou alguém para ouvir o que já tinha sido pedido. Consome e esquece —
  // guardar depois de entregue faria o salto repetir a cada remontagem da
  // lista, e trocar de canal e voltar remonta.
  const guardado = pendentes.get(channelId);
  if (guardado !== undefined) {
    pendentes.delete(channelId);
    ouvinte(guardado);
  }

  return () => {
    const atual = saltadores.get(channelId);
    if (!atual) return;
    atual.delete(ouvinte);
    if (atual.size === 0) saltadores.delete(channelId);
  };
}
