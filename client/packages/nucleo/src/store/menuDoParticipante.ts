/**
 * Sobre QUEM o menu do participante de voz foi aberto.
 *
 * ⚠ **Um alvo em store e um `ContextMenu` por superfície — nunca um por
 * ladrilho.** É o padrão da lista de mensagens e da member list: quem recebe o
 * clique direito escreve quem é, e um único Root lê. A grade monta um ladrilho
 * por pessoa e a coluna de canais uma linha por pessoa em cada sala; um Root,
 * Trigger e Portal em cada um é o custo que já foi medido e removido da lista.
 *
 * Store próprio e não uma terceira variante de `AlvoDoMenu`: o menu da
 * mensagem e o da member list não sabem desenhar participante, e uma variante
 * ali obrigaria os dois a tratar um caso que nunca chega a eles.
 *
 * O canal vai junto porque o menu diz "em <sala>" e porque moderar exige saber
 * de qual servidor — uma DM em chamada não tem servidor, e aí a moderação some.
 */

export type AlvoDoParticipante = {
  readonly userId: string;
  readonly channelId: string;
};

let alvo: AlvoDoParticipante | null = null;

const ouvintes = new Set<() => void>();

export function assinarMenuDoParticipante(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerAlvoDoParticipante(): AlvoDoParticipante | null {
  return alvo;
}

/**
 * Comparação por CAMPO: quem chama monta o objeto no handler, e por referência
 * dois cliques na mesma pessoa republicariam à toa — a mesma decisão de
 * `definirAlvoDoMenu`.
 */
export function definirAlvoDoParticipante(novo: AlvoDoParticipante | null): void {
  if (alvo === null || novo === null) {
    if (alvo === novo) return;
  } else if (alvo.userId === novo.userId && alvo.channelId === novo.channelId) {
    return;
  }
  alvo = novo;
  for (const o of ouvintes) o();
}

/**
 * O alvo a partir de onde o evento nasceu.
 *
 * ⚠ **Lido do DOM e não passado por prop**, e é o que permite a superfície
 * inteira ter UM handler de captura: o ladrilho só carrega
 * `data-participante`, e não precisa de função nenhuma — que no ladrilho
 * `memo` da grade seria uma prop nova a cada render do pai.
 */
export function alvoDoEvento(
  alvoDoDom: EventTarget | null,
  channelId: string,
): AlvoDoParticipante | null {
  /* Pato e não `instanceof Element`: um nó de texto ou um alvo de outro
     `window` (o popout) não é `Element` DESTE realm, e o menu não abriria. */
  const no = alvoDoDom as Partial<Element> | null;
  if (typeof no?.closest !== "function") return null;
  const el = (no as Element).closest<HTMLElement>("[data-participante]");
  const userId = el?.dataset.participante;
  if (!userId || channelId === "") return null;
  return { userId, channelId };
}

/**
 * Abre o menu a partir do botão `⋯`, disparando o evento que o `Trigger` já
 * escuta — o mesmo arranjo do `⋯` da barra de ações da mensagem. Dois menus
 * com os mesmos itens, um de botão e um de clique direito, divergiriam no
 * primeiro item novo.
 */
export function abrirMenuDoParticipante(botao: HTMLElement): void {
  const caixa = botao.getBoundingClientRect();
  botao.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: caixa.left,
      clientY: caixa.bottom,
    }),
  );
}
