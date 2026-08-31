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

const alvos = new Map<string, string>();
const ouvintes = new Map<string, Set<Ouvinte>>();

function avisar(channelId: string): void {
  const set = ouvintes.get(channelId);
  if (!set) return;
  for (const ouvinte of set) ouvinte();
}

export function alvoDeResposta(channelId: string): string | undefined {
  return alvos.get(channelId);
}

export function responderA(channelId: string, messageId: string): void {
  if (alvos.get(channelId) === messageId) return;
  alvos.set(channelId, messageId);
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
