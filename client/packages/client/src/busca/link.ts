import { caminhoDe } from "../rota/rota";

/**
 * O permalink de um resultado de busca, ou nada.
 *
 * ⚠ **A primeira versão montava `/servidor/-/canal/…`** — um servidor chamado
 * "-" que a rota lê como ID e não resolve. O link abria lugar nenhum, e quem
 * cola não descobre. O caminho sai de `caminhoDe`, a mesma projeção que a
 * barra de endereço usa, então os dois não divergem.
 *
 * Sem servidor (DM, grupo, notas) não há link: `/dm/:c` não carrega mensagem,
 * e um link que abre a conversa na posição errada é pior que não ter o botão —
 * mesma regra do "Copiar link" do menu da mensagem.
 */
export function linkDoResultado(
  origem: string,
  serverId: string | undefined,
  channelId: string,
  messageId: string,
): string | undefined {
  if (serverId === undefined || serverId === "") return undefined;
  return `${origem}${caminhoDe({ tipo: "servidor", serverId, channelId })}/${messageId}`;
}
