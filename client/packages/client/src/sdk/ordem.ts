/**
 * A ordem em que os canais e os servidores aparecem — lida sem assinar.
 *
 * ⚠ **Existia dentro de `paleta/indice.ts` e passou a ter um segundo
 * consumidor**: os atalhos de "canal anterior / próximo" precisam da MESMA
 * sequência que a coluna desenha, senão ⌥↓ pula um canal que está na tela e
 * abre um que não está. Duas cópias da mesma pergunta divergem, e a que
 * diverge é a que ninguém abriu naquela semana — o `CLAUDE.md` tem seis
 * ocorrências desse padrão registradas.
 *
 * `peek` e não `getSnapshot` pela mesma razão do índice da paleta: ler sem
 * assinar é exatamente o que se quer aqui. Quem chama é um atalho de teclado
 * ou a abertura de um modal — momentos humanos, não caminho quente.
 *
 * Mora em `sdk/` porque o que ele faz é `peek` nos stores do adapter, que é
 * onde a fronteira de import põe esse tipo de leitura.
 */
import {
  canaisDeTexto,
  canaisDeVoz,
  categorias,
  conversas,
  RAIZ,
  serverIds,
} from "./adapter";

/**
 * Os canais de um servidor, na ordem da coluna.
 *
 * Pelas CATEGORIAS quando elas existem: é a ordem que quem administra
 * definiu, e nem a paleta nem o atalho devem reordenar o que a coluna
 * respeita. Sem categorias, texto antes de voz — que é a ordem em que a
 * coluna os empilha.
 */
export function canaisOrdenados(serverId: string): readonly string[] {
  const grupos = categorias.peek(serverId);
  if (grupos) return grupos.flatMap((g) => [...g.canais]);
  return [
    ...(canaisDeTexto.peek(serverId) ?? []),
    ...(canaisDeVoz.peek(serverId) ?? []),
  ];
}

/** Os servidores do rail, na ordem em que ele os desenha. */
export function servidoresOrdenados(): readonly string[] {
  return serverIds.peek(RAIZ) ?? [];
}

/** As conversas da casa, na ordem em que a coluna as lista. */
export function conversasOrdenadas(): readonly string[] {
  return conversas.peek(RAIZ) ?? [];
}

/**
 * O vizinho de `atual` numa lista, dando a volta.
 *
 * ⚠ **Item ausente da lista devolve a PRIMEIRA posição, e não `undefined`.**
 * O caso real é o servidor sem canal aberto: apertar ⌥↓ ali tem que abrir o
 * primeiro canal, não falhar em silêncio — que é o pior comportamento
 * possível de um atalho, porque quem tenta uma vez e não vê nada acontecer
 * não tenta de novo.
 */
export function vizinho(
  lista: readonly string[],
  atual: string | undefined,
  passo: 1 | -1,
): string | undefined {
  if (lista.length === 0) return undefined;
  const i = atual === undefined ? -1 : lista.indexOf(atual);
  if (i < 0) return passo === 1 ? lista[0] : lista[lista.length - 1];
  return lista[(i + passo + lista.length) % lista.length];
}
