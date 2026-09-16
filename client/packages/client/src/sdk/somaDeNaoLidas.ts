/**
 * O rollup de não-lidas por servidor, como regra pura.
 *
 * ⚠ **Canal mudo não soma NÃO-LIDA ao servidor, e continua somando MENÇÃO.**
 * É a mesma regra que a coluna já aplica ao canal ("silenciado apaga o realce
 * e mantém a contagem") levada um degrau acima: silenciar um canal — ou o
 * servidor inteiro — existe para o rail parar de acender por conversa que a
 * pessoa decidiu ignorar. Uma menção, por outro lado, é alguém chamando pelo
 * nome; escondê-la porque o canal está mudo seria perder justamente o que
 * atravessa o silêncio em todo cliente da categoria.
 *
 * Pura e fora do adapter para ter teste sem SDK: o adapter só entrega as
 * contagens por canal, quem é o servidor de cada um e quem está mudo.
 */

export type ContagemDeCanal = { readonly naoLidas: number; readonly mencoes: number };

export function somarPorServidor(
  contagens: Iterable<readonly [string, ContagemDeCanal]>,
  servidorDe: (channelId: string) => string | undefined,
  mudo: (channelId: string, serverId: string) => boolean,
): Map<string, { naoLidas: number; mencoes: number }> {
  const soma = new Map<string, { naoLidas: number; mencoes: number }>();
  for (const [channelId, c] of contagens) {
    const serverId = servidorDe(channelId);
    if (!serverId) continue;
    const naoLidas = mudo(channelId, serverId) ? 0 : c.naoLidas;
    if (naoLidas === 0 && c.mencoes === 0) continue;
    const atual = soma.get(serverId);
    if (atual) {
      atual.naoLidas += naoLidas;
      atual.mencoes += c.mencoes;
    } else {
      soma.set(serverId, { naoLidas, mencoes: c.mencoes });
    }
  }
  return soma;
}
