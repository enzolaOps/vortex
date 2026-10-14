import { client } from "./client";

/**
 * Mensagens fixadas de um canal — a camada anticorrupção.
 *
 * O protocolo tem `Channel.search({ pinned: true })` (sem `query`: o servidor
 * recusa os dois juntos). A resposta é paginada por CURSOR (`before`), do mais
 * novo para o mais antigo, e o SDK materializa cada mensagem no cache — então o
 * painel lê o conteúdo pelo mesmo store de snapshots da lista.
 *
 * Devolve só IDs do SDK: nada do protocolo sai daqui.
 */

/** Por página. Um canal com mais de 50 fixadas é raro; o resto vem por botão. */
export const POR_PAGINA_DE_FIXADAS = 50;

export type PaginaDeFixadas = {
  /** Do mais novo para o mais antigo. */
  readonly ids: readonly string[];
  /** A página veio cheia: pode haver mais. */
  readonly temMais: boolean;
};

/** `undefined` = a consulta falhou (rede, servidor, canal fora do cache). */
export async function buscarFixadas(
  channelId: string,
  antesDe?: string,
): Promise<PaginaDeFixadas | undefined> {
  const canal = client.channels.get(channelId);
  if (!canal) return undefined;
  try {
    const achadas = await canal.search({
      pinned: true,
      sort: "Latest",
      limit: POR_PAGINA_DE_FIXADAS,
      ...(antesDe !== undefined ? { before: antesDe } : {}),
    });
    return {
      ids: achadas.map((m) => m.id),
      temMais: achadas.length === POR_PAGINA_DE_FIXADAS,
    };
  } catch {
    return undefined;
  }
}
