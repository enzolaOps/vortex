/**
 * Canais silenciados.
 *
 * Store LOCAL, e isso não é preguiça: o SDK não tem escrita para isto. Ele
 * expõe `channel.muted` como uma pergunta que o APP responde, via a opção
 * `channelIsMuted` — a decisão é do cliente por desenho do protocolo.
 *
 * Sincronizar entre dispositivos é possível (vai em configuração de usuário) e
 * fica listado. Local é o estado honesto de um app sem sessão, e a forma não
 * muda quando a sincronia chegar: o store continua sendo a fonte, e quem
 * sincroniza escreve nele.
 *
 * Como o colapso de categoria, e pela mesma razão: preferência de leitura por
 * canal, mudada por clique humano, lida por um booleano. Um store por chave
 * seria maquinário para dezenas de itens.
 */

const silenciados = new Set<string>();
const ouvintes = new Set<() => void>();

export function assinarSilencio(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Booleano, comparado por valor — quem assina só acorda se o SEU canal mudar. */
export function estaSilenciado(channelId: string): boolean {
  return silenciados.has(channelId);
}

export function alternarSilencio(channelId: string): void {
  if (!silenciados.delete(channelId)) silenciados.add(channelId);
  for (const ouvinte of ouvintes) ouvinte();
}

/** Estado limpo entre testes. */
export function limparSilencio(): void {
  silenciados.clear();
}
