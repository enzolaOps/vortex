/**
 * "🧵 Rafa e Nando entraram no tópico" (D-CANAIS-23), como LINHA EFÊMERA.
 *
 * ⚠ **Derivada do que já chega pelo fio, e não uma mensagem de sistema nova.**
 * Entrar num tópico é passar a SEGUI-LO — por "Seguir" ou por responder, que
 * segue sozinho (`message_send.rs`) —, e as duas rotas já publicam um
 * `ChannelUpdate` com `thread.followers` inteiro. A linha é a diferença entre
 * a lista de antes e a de depois. Nenhum byte a mais no protocolo.
 *
 * A alternativa — uma variante nova de `SystemMessage` gravada no Mongo — cai
 * pela mesma razão medida no PR #304 (ver `sdk/eventosDaSala.ts`): `pushd`,
 * `crond` e `voice-ingress` rodam a imagem UPSTREAM, o `serde` deles não
 * conhece a variante e recusa o documento. E todo cliente Stoat veria a linha
 * "`thread_joined` is not supported.".
 *
 * **O que isso custa, dito uma vez:** a linha só existe para quem estava com o
 * app aberto quando a pessoa entrou. Recarregar a página a apaga, e quem abre o
 * tópico amanhã não a vê. É a mesma fronteira das linhas da sala de voz, e o
 * design não a contradiz — ele desenha a linha no FIM da conversa, que é onde
 * uma chegada recente mora.
 *
 * Três recortes, cada um com razão:
 *
 * - **Você não entra na sua própria linha.** Quem clicou em "Seguir" sabe que
 *   seguiu; a linha é notícia sobre os OUTROS.
 * - **Quem entrou RESPONDENDO também não.** A resposta dele acabou de cair na
 *   conversa, logo acima; "Rafa entrou no tópico" embaixo da fala do Rafa é a
 *   mesma informação duas vezes. O `ChannelUpdate` chega depois da `Message`
 *   (o servidor segue o tópico depois de criar a mensagem), e o registro de
 *   tópicos já anotou o autor dela como `ultimoAutorId`.
 * - **Entradas seguidas se juntam** — "Rafa e Nando", como o design escreve —,
 *   desde que nada tenha sido dito no meio e a primeira tenha menos de
 *   `JANELA_DE_AGRUPAMENTO_MS`. Uma linha por pessoa numa leva de cinco
 *   entradas empurraria a conversa para fora da tela por burocracia.
 *
 * Módulo PURO: decide e guarda o registro. Quem põe na lista é o adapter.
 */
import { decodeTime } from "ulid";

import type { SistemaSnapshot } from "./domain";

/**
 * Até quanto tempo depois da primeira entrada uma nova ainda se junta à linha.
 *
 * Cinco minutos é a janela em que "entraram" ainda lê como UM acontecimento.
 * Depois disso a hora da linha — que é a da primeira entrada — passaria a
 * mentir sobre a segunda.
 */
export const JANELA_DE_AGRUPAMENTO_MS = 5 * 60_000;

/**
 * Quem passou a seguir o tópico, na ordem em que o servidor anexou.
 *
 * `antes` ausente é "não sei quem seguia" — tópico que o registro ainda não
 * tinha visto —, e aí NADA vira linha: afirmar que todo mundo acabou de entrar
 * seria o `Ready` virando uma avalanche de chegadas.
 */
export function quemEntrou(
  antes: readonly string[] | undefined,
  depois: readonly string[] | undefined,
  recortes: { readonly eu: string | undefined; readonly respondeu: string | undefined },
): readonly string[] {
  if (antes === undefined || depois === undefined) return [];
  const ja = new Set(antes);
  return depois.filter(
    (id) => !ja.has(id) && id !== recortes.eu && id !== recortes.respondeu,
  );
}

/* ------------------------------------------------------------- registro */

type Linha = { readonly canal: string; readonly sistema: SistemaSnapshot & { tipo: "entrouNoTopico" } };

/**
 * As linhas vivas, por ID local — o que `toSistema` consulta antes do SDK,
 * pela mesma razão das linhas da sala: a frase é montada no componente.
 */
const linhas = new Map<string, Linha>();

export function registrarEntrada(id: string, canal: string, userIds: readonly string[]): void {
  linhas.set(id, { canal, sistema: { tipo: "entrouNoTopico", userIds } });
}

export function lerEntrada(id: string): SistemaSnapshot | undefined {
  return linhas.get(id)?.sistema;
}

/**
 * É uma linha efêmera, e portanto um ID que o SERVIDOR não conhece — a mesma
 * guarda de `ehLinhaDeSala`, para o `ack` nunca mandar um ULID inventado.
 */
export function ehEntradaNoTopico(id: string): boolean {
  return linhas.has(id);
}

/**
 * Onde as novas entradas vão parar: juntar-se à linha `ultimoId` ou abrir
 * uma nova.
 *
 * Junta só se a ÚLTIMA coisa da conversa já é uma linha de entrada deste
 * tópico e ela ainda está na janela. Devolve a lista mesclada, sem repetir
 * quem já estava — um seguir/deixar/seguir de novo não põe a mesma pessoa
 * duas vezes na frase.
 */
export function juntarOuAbrir(
  ultimoId: string | undefined,
  canal: string,
  novos: readonly string[],
  agoraMs: number,
): { readonly juntarEm: string; readonly userIds: readonly string[] } | undefined {
  if (ultimoId === undefined) return undefined;
  const l = linhas.get(ultimoId);
  if (l === undefined || l.canal !== canal) return undefined;
  if (agoraMs - decodeTime(ultimoId) > JANELA_DE_AGRUPAMENTO_MS) return undefined;
  const userIds = [...l.sistema.userIds];
  for (const id of novos) if (!userIds.includes(id)) userIds.push(id);
  return { juntarEm: ultimoId, userIds };
}

/**
 * Quantos nomes a frase escreve antes de virar "e mais N".
 *
 * Três é onde "Rafa, Nando e Júlia" ainda cabe numa linha de 12px; o quarto
 * nome faria a frase quebrar na coluna estreita de um popout.
 */
export const NOMES_NA_FRASE = 3;

/** Os nomes que a frase escreve e quantos ficam no "e mais N". */
export function recorteDaFrase(userIds: readonly string[]): {
  readonly nomes: readonly string[];
  readonly resto: number;
} {
  if (userIds.length <= NOMES_NA_FRASE) return { nomes: userIds, resto: 0 };
  return { nomes: userIds.slice(0, NOMES_NA_FRASE - 1), resto: userIds.length - (NOMES_NA_FRASE - 1) };
}

/** Estado limpo entre testes. */
export function limparEntradasNoTopico(): void {
  linhas.clear();
}
