/**
 * A fronteira React do store. Nada além daqui conhece `useSyncExternalStore`.
 */
import { useSyncExternalStore } from "react";

import {
  canaisDeTexto,
  canaisDeVoz,
  channelMessageIds,
  channels,
  members,
  membrosOffline,
  membrosOnline,
  messages,
  presence,
  RAIZ,
  serverIds,
  servers,
  typing,
} from "../sdk/adapter";
import type {
  ChannelSnapshot,
  ChaveDeMembro,
  MemberSnapshot,
  MessageSnapshot,
  PresenceStatus,
  ServerSnapshot,
} from "../sdk/domain";
import {
  assinarNavegacao,
  lerCanalAtivo,
  lerServidorAtivo,
} from "./navegacao";
import { rascunhos, RASCUNHO_VAZIO } from "./rascunhos";

const NO_IDS: readonly string[] = [];

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

export function useMembrosOffline(serverId: string): readonly string[] {
  const getSnapshot = () => membrosOffline.getSnapshot(serverId) ?? NO_IDS;
  if (import.meta.env.DEV) {
    assertStable(getSnapshot, `useMembrosOffline(${serverId})`);
  }
  return useSyncExternalStore(membrosOffline.subscriber(serverId), getSnapshot);
}

/* ------------------------------------------------------------- navegação */

export function useServidorAtivo(): string {
  return useSyncExternalStore(assinarNavegacao, lerServidorAtivo);
}

export function useCanalAtivo(): string {
  return useSyncExternalStore(assinarNavegacao, lerCanalAtivo);
}
