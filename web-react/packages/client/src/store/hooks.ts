/**
 * A fronteira React do store. Nada além daqui conhece `useSyncExternalStore`.
 */
import { useSyncExternalStore } from "react";

import {
  canaisDeTexto,
  categorias,
  canaisDeVoz,
  channelMessageIds,
  channels,
  members,
  membrosOffline,
  membrosOnline,
  secoesOnline,
  messages,
  presence,
  RAIZ,
  serverIds,
  servers,
  typing,
  vozPorCanal,
} from "../sdk/adapter";
import type {
  CategoriaDeCanais,
  ChannelSnapshot,
  ChaveDeMembro,
  MemberSnapshot,
  SecaoDeMembros,
  MessageSnapshot,
  ParticipanteDeVoz,
  PresenceStatus,
  ServerSnapshot,
} from "../sdk/domain";
import {
  assinarNavegacao,
  lerCanalAtivo,
  lerServidorAtivo,
} from "./navegacao";
import { assinarColapso, estaColapsada } from "./colapso";
import { rascunhos, RASCUNHO_VAZIO } from "./rascunhos";

const NO_IDS: readonly string[] = [];
const NO_SECOES: readonly SecaoDeMembros[] = [];
const NO_VOZ: readonly ParticipanteDeVoz[] = [];
const NO_CATEGORIAS: readonly CategoriaDeCanais[] = [];

/**
 * Assertion de dev para a armadilha nº 1 do projeto.
 *
 * `useSyncExternalStore` chama `getSnapshot` a cada render e compara por
 * `Object.is`. Se o getter alocar, cada chamada devolve referência nova, o
 * React acha que mudou, re-renderiza e chama de novo — loop infinito que se
 * manifesta como aba travando, não como erro.
 *
 * Cinco linhas que se pagam na primeira ocorrência. Some em produção.
 */
export function assertStable<T>(getSnapshot: () => T, label: string) {
  const first = getSnapshot();
  const second = getSnapshot();
  if (!Object.is(first, second)) {
    throw new Error(
      `[vortex] getSnapshot instável em ${label}: duas chamadas seguidas ` +
        `devolveram referências diferentes sem a entidade ter mudado. ` +
        `Derivação vai no adapter, nunca no getter.`,
    );
  }
}

export function useMessage(id: string): MessageSnapshot | undefined {
  const getSnapshot = () => messages.getSnapshot(id);
  if (import.meta.env.DEV) assertStable(getSnapshot, `useMessage(${id})`);
  return useSyncExternalStore(messages.subscriber(id), getSnapshot);
}

export function useChannelMessageIds(channelId: string): readonly string[] {
  const getSnapshot = () => channelMessageIds.getSnapshot(channelId) ?? NO_IDS;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useChannelMessageIds(${channelId})`);
  }
  return useSyncExternalStore(
    channelMessageIds.subscriber(channelId),
    getSnapshot,
  );
}

export function usePresence(userId: string): PresenceStatus {
  return useSyncExternalStore(
    presence.subscriber(userId),
    () => presence.getSnapshot(userId) ?? "offline",
  );
}

export function useTyping(channelId: string): readonly string[] {
  return useSyncExternalStore(
    typing.subscriber(channelId),
    () => typing.getSnapshot(channelId) ?? NO_IDS,
  );
}

/**
 * Rascunho do canal.
 *
 * Muda uma vez por tecla — é o valor mais quente do app. Assinado por canal, é
 * o composer que acorda e mais ninguém: a lista de mensagens não re-renderiza
 * porque alguém está escrevendo.
 */
export function useRascunho(channelId: string): string {
  const getSnapshot = () => rascunhos.getSnapshot(channelId) ?? RASCUNHO_VAZIO;
  if (import.meta.env.DEV) assertStable(getSnapshot, `useRascunho(${channelId})`);
  return useSyncExternalStore(rascunhos.subscriber(channelId), getSnapshot);
}

/* ------------------------------------------------------- colunas laterais */

export function useServerIds(): readonly string[] {
  const getSnapshot = () => serverIds.getSnapshot(RAIZ) ?? NO_IDS;
  if (import.meta.env.DEV) assertStable(getSnapshot, "useServerIds");
  return useSyncExternalStore(serverIds.subscriber(RAIZ), getSnapshot);
}

export function useServer(id: string): ServerSnapshot | undefined {
  const getSnapshot = () => servers.getSnapshot(id);
  if (import.meta.env.DEV) assertStable(getSnapshot, `useServer(${id})`);
  return useSyncExternalStore(servers.subscriber(id), getSnapshot);
}

/**
 * Texto e voz assinam separado, pelo mesmo motivo dos baldes de membro: canal
 * de voz criado não republica a seção de texto, e vice-versa.
 */
/**
 * Uma categoria está colapsada?
 *
 * Assina o store inteiro e devolve um booleano — e isso é seguro justamente
 * porque é booleano: `Object.is` compara por valor, então uma categoria só
 * re-renderiza quando o PRÓPRIO estado dela muda, mesmo o store notificando
 * todas. Guardar preferência de leitura por categoria num store por chave
 * seria maquinário para dezenas de itens que mudam por clique humano.
 */
export function useColapso(categoriaId: string): boolean {
  return useSyncExternalStore(assinarColapso, () => estaColapsada(categoriaId));
}

export function useCategorias(serverId: string): readonly CategoriaDeCanais[] {
  const getSnapshot = () => categorias.getSnapshot(serverId) ?? NO_CATEGORIAS;
  if (import.meta.env.DEV) assertStable(getSnapshot, `useCategorias(${serverId})`);
  return useSyncExternalStore(categorias.subscriber(serverId), getSnapshot);
}

export function useCanaisDeTexto(serverId: string): readonly string[] {
  const getSnapshot = () => canaisDeTexto.getSnapshot(serverId) ?? NO_IDS;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useCanaisDeTexto(${serverId})`);
  }
  return useSyncExternalStore(canaisDeTexto.subscriber(serverId), getSnapshot);
}

export function useCanaisDeVoz(serverId: string): readonly string[] {
  const getSnapshot = () => canaisDeVoz.getSnapshot(serverId) ?? NO_IDS;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useCanaisDeVoz(${serverId})`);
  }
  return useSyncExternalStore(canaisDeVoz.subscriber(serverId), getSnapshot);
}

export function useChannel(id: string): ChannelSnapshot | undefined {
  const getSnapshot = () => channels.getSnapshot(id);
  if (import.meta.env.DEV) assertStable(getSnapshot, `useChannel(${id})`);
  return useSyncExternalStore(channels.subscriber(id), getSnapshot);
}

/**
 * Um membro, pela chave composta.
 *
 * O parâmetro é `ChaveDeMembro` e não `string` de propósito: apelido, cor de
 * cargo e castigo são POR SERVIDOR, e um ID de usuário sozinho não sabe de
 * qual servidor se fala. Com o tipo marcado, `useMembro(userId)` não compila —
 * sem ele, compilaria e devolveria `undefined` para sempre.
 */
export function useMembro(chave: ChaveDeMembro): MemberSnapshot | undefined {
  const getSnapshot = () => members.getSnapshot(chave);
  if (import.meta.env.DEV) assertStable(getSnapshot, `useMembro(${chave})`);
  return useSyncExternalStore(members.subscriber(chave), getSnapshot);
}

/**
 * Os dois baldes assinam separado.
 *
 * Alguém ficar offline republica UM dos dois arrays na maior parte das vezes —
 * e mesmo quando republica os dois, quem re-renderiza é a member list, não as
 * linhas: elas assinam a si mesmas por ID.
 */
export function useMembrosOnline(serverId: string): readonly string[] {
  const getSnapshot = () => membrosOnline.getSnapshot(serverId) ?? NO_IDS;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useMembrosOnline(${serverId})`);
  }
  return useSyncExternalStore(membrosOnline.subscriber(serverId), getSnapshot);
}

/**
 * As seções de cargo do lado online.
 *
 * Assina separado dos baldes: um painel estreito que só mostra avatares não
 * renderiza seção nenhuma e não precisa acordar quando um cargo é renomeado.
 */
export function useSecoesOnline(serverId: string): readonly SecaoDeMembros[] {
  const getSnapshot = () => secoesOnline.getSnapshot(serverId) ?? NO_SECOES;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useSecoesOnline(${serverId})`);
  }
  return useSyncExternalStore(secoesOnline.subscriber(serverId), getSnapshot);
}

export function useMembrosOffline(serverId: string): readonly string[] {
  const getSnapshot = () => membrosOffline.getSnapshot(serverId) ?? NO_IDS;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useMembrosOffline(${serverId})`);
  }
  return useSyncExternalStore(membrosOffline.subscriber(serverId), getSnapshot);
}

/**
 * Quem está dentro de um canal de voz.
 *
 * Assina por CANAL: alguém entrando na sala A não acorda a linha da sala B.
 */
export function useVozDoCanal(channelId: string): readonly ParticipanteDeVoz[] {
  const getSnapshot = () => vozPorCanal.getSnapshot(channelId) ?? NO_VOZ;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useVozDoCanal(${channelId})`);
  }
  return useSyncExternalStore(vozPorCanal.subscriber(channelId), getSnapshot);
}

/* ------------------------------------------------------------- navegação */

export function useServidorAtivo(): string {
  return useSyncExternalStore(assinarNavegacao, lerServidorAtivo);
}

export function useCanalAtivo(): string {
  return useSyncExternalStore(assinarNavegacao, lerCanalAtivo);
}
