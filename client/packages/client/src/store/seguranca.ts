/**
 * A fronteira React da política de acesso e da fila de pedidos.
 *
 * Arquivo próprio e não `hooks.ts`: os stores moram em `sdk/seguranca.ts`, que
 * registra o ouvinte de evento cru ao ser importado — pendurá-los em `hooks.ts`
 * faria todo consumidor de hook carregar a fila de pedidos junto.
 */
import { useSyncExternalStore } from "react";

import {
  filas,
  politicas,
  POLITICA_PADRAO,
  type EstadoDaFila,
  type PoliticaDoServidor,
} from "../sdk/seguranca";
import { assertStable } from "./hooks";

const FILA_CARREGANDO: EstadoDaFila = "carregando";

export function usePolitica(serverId: string): PoliticaDoServidor {
  const getSnapshot = () => politicas.getSnapshot(serverId) ?? POLITICA_PADRAO;
  if (import.meta.env.DEV) assertStable(getSnapshot, `usePolitica(${serverId})`);
  return useSyncExternalStore(politicas.subscriber(serverId), getSnapshot);
}

export function useFilaDePedidos(serverId: string): EstadoDaFila {
  const getSnapshot = () => filas.getSnapshot(serverId) ?? FILA_CARREGANDO;
  if (import.meta.env.DEV) assertStable(getSnapshot, `useFilaDePedidos(${serverId})`);
  return useSyncExternalStore(filas.subscriber(serverId), getSnapshot);
}
