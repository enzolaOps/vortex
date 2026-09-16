/**
 * As assinaturas das figurinhas e dos efeitos sonoros.
 *
 * Mesma disciplina de `store/hooks.ts`: o getter só LÊ o store, e toda
 * derivação que alocaria (filtrar, ordenar) fica em quem renderiza.
 */
import { useSyncExternalStore } from "react";

import {
  figurinhas,
  figurinhasDoServidor,
  sonsDoServidor,
  type EfeitoSonoro,
  type Figurinha,
  type ListaDeExpressoes,
} from "../sdk/expressoes";
import { assertStable } from "../store/hooks";
import {
  assinarSoundboard,
  lerTocando,
  lerVolumeDoPainel,
} from "../store/soundboard";

/** Referência única — a armadilha nº 1 do projeto. */
const CARREGANDO = { estado: "carregando" } as const;

export function useFigurinhasDoServidor(serverId: string): ListaDeExpressoes<Figurinha> {
  const getSnapshot = () => figurinhasDoServidor.getSnapshot(serverId) ?? CARREGANDO;
  if (import.meta.env.DEV) assertStable(getSnapshot, `useFigurinhasDoServidor(${serverId})`);
  return useSyncExternalStore(figurinhasDoServidor.subscriber(serverId), getSnapshot);
}

export function useSonsDoServidor(serverId: string): ListaDeExpressoes<EfeitoSonoro> {
  const getSnapshot = () => sonsDoServidor.getSnapshot(serverId) ?? CARREGANDO;
  if (import.meta.env.DEV) assertStable(getSnapshot, `useSonsDoServidor(${serverId})`);
  return useSyncExternalStore(sonsDoServidor.subscriber(serverId), getSnapshot);
}

export function useFigurinha(id: string): Figurinha | undefined {
  const getSnapshot = () => figurinhas.getSnapshot(id);
  if (import.meta.env.DEV) assertStable(getSnapshot, `useFigurinha(${id})`);
  return useSyncExternalStore(figurinhas.subscriber(id), getSnapshot);
}

export function useVolumeDoPainel(): number {
  return useSyncExternalStore(assinarSoundboard, lerVolumeDoPainel);
}

/**
 * Este som está tocando? Booleano de propósito: `Object.is` por valor faz só o
 * ladrilho que MUDOU re-renderizar, mesmo o store avisando todos.
 */
export function useTocando(somId: string): boolean {
  return useSyncExternalStore(assinarSoundboard, () => lerTocando().includes(somId));
}
