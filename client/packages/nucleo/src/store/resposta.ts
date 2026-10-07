/**
 * A quem o composer está respondendo, por canal.
 *
 * Store próprio e não um campo do rascunho, embora os dois sejam "o que está
 * sendo escrito naquele canal": o rascunho muda a cada TECLA e é o valor mais
 * quente do app; o alvo da resposta muda por clique. Juntos, escolher uma
 * mensagem para responder republicaria o rascunho e vice-versa.
 *
 * Keyed por canal pelo mesmo motivo do rascunho: quem começa a responder no
 * `#geral`, troca para `#links` e volta, encontra a resposta ainda armada.
 */

type Ouvinte = () => void;

/**
 * O alvo e se ele deve ser NOTIFICADO.
 *
 * ⚠ **`mencionar` mora aqui e não no envio, porque é escolha de quem responde
 * e ela acontece ANTES de escrever.** Quem clica em "Responder sem mencionar"
 * decide no menu; o composer só carrega a decisão até o envio. Guardá-la no
 * momento do envio exigiria um segundo caminho paralelo ao rascunho, com a
 * mesma pergunta ("quem é o alvo?") respondida em dois lugares.
 */
export type AlvoDeResposta = {
  readonly messageId: string;
  readonly mencionar: boolean;
};

const alvos = new Map<string, AlvoDeResposta>();
const ouvintes = new Map<string, Set<Ouvinte>>();

function avisar(channelId: string): void {
  const set = ouvintes.get(channelId);
  if (!set) return;
  for (const ouvinte of set) ouvinte();
}

export function alvoDeResposta(
  channelId: string,
): AlvoDeResposta | undefined {
  return alvos.get(channelId);
}

/**
 * Arma a resposta.
 *
 * ⚠ **`mencionar` é `true` por padrão, e o inverso era o comportamento até
 * agora.** O envio mandava `mention: false` em TODA resposta, com a razão
 * escrita no adapter: *"enquanto `responderSemMencionar` não existe, o inverso
 * transformaria toda resposta numa menção que ninguém pediu"*. Agora a escolha
 * existe, então o padrão passa a ser o que a pessoa espera de "Responder" — a
 * outra pessoa fica sabendo.
 *
 * ⚠ **Comparação por CAMPO e não por referência.** Um objeto novo a cada
 * chamada faria o `getSnapshot` devolver referência diferente para o mesmo
 * estado, e o composer re-renderizaria a cada clique repetido — a armadilha
 * nº 1 do briefing.
 */
export function responderA(
  channelId: string,
  messageId: string,
  mencionar = true,
): void {
  const atual = alvos.get(channelId);
  if (atual?.messageId === messageId && atual.mencionar === mencionar) return;
  alvos.set(channelId, { messageId, mencionar });
  avisar(channelId);
}

export function cancelarResposta(channelId: string): void {
  if (!alvos.delete(channelId)) return;
  avisar(channelId);
}

export function assinarResposta(
  channelId: string,
  ouvinte: Ouvinte,
): () => void {
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
    // Canal visitado uma vez não deixa um Set vazio para sempre — erro nº 5 do
    // briefing na sua forma mais barata de evitar.
    if (atual.size === 0) ouvintes.delete(channelId);
  };
}
