/**
 * Store externo, module-level. Lei nº 1.
 *
 * Duas propriedades sustentam tudo o que vem depois:
 *
 * 1. `getSnapshot` devolve a referência guardada no Map. Nunca aloca. É a
 *    armadilha nº 1 do projeto — montar objeto no getter faz o
 *    `useSyncExternalStore` comparar por `Object.is`, achar que mudou, e
 *    entrar em loop que se manifesta como aba travando, sem erro.
 *
 * 2. Subscrição com refcount. `StrictMode` invoca effects duas vezes em dev; a
 *    defesa é estrutural e não por flag: assinar duas vezes e desassinar duas
 *    vezes tem que ser inofensivo.
 */

type Listener = () => void;

export type EntityStore<T> = {
  /** Estável por `id` — o `useSyncExternalStore` exige referência estável. */
  subscriber(id: string): (listener: Listener) => () => void;
  getSnapshot(id: string): T | undefined;
  set(id: string, snapshot: T): void;
  peek(id: string): T | undefined;
  subscriberCount(id: string): number;
};

export function createEntityStore<T>(
  /** Chamado quando o PRIMEIRO assinante de `id` chega. Devolve o teardown. */
  onFirstSubscribe?: (id: string) => (() => void) | void,
): EntityStore<T> {
  const snapshots = new Map<string, T>();
  const listeners = new Map<string, Set<Listener>>();
  const teardowns = new Map<string, () => void>();
  const subscribers = new Map<string, (listener: Listener) => () => void>();

  function subscribe(id: string, listener: Listener): () => void {
    let set = listeners.get(id);
    if (!set) {
      set = new Set();
      listeners.set(id, set);
      const teardown = onFirstSubscribe?.(id);
      if (teardown) teardowns.set(id, teardown);
    }
    set.add(listener);

    return () => {
      const current = listeners.get(id);
      if (!current) return;
      current.delete(listener);
      if (current.size > 0) return;

      listeners.delete(id);
      // Último assinante saiu: solta a subscrição no SDK. Sem isso, uma sessão
      // de 8h acumula efeitos de todo canal já visitado.
      teardowns.get(id)?.();
      teardowns.delete(id);
      // O snapshot FICA. Descartá-lo aqui garante que toda remontagem de linha
      // comece em `undefined` — e numa lista virtualizada isso realimenta o
      // virtualizador. O que vaza é o efeito, não o objeto; a evicção do cache
      // é política à parte, com teto, não consequência de scroll.
    };
  }

  return {
    subscriber(id) {
      let bound = subscribers.get(id);
      if (!bound) {
        bound = (listener) => subscribe(id, listener);
        subscribers.set(id, bound);
      }
      return bound;
    },
    getSnapshot(id) {
      return snapshots.get(id);
    },
    peek(id) {
      return snapshots.get(id);
    },
    set(id, snapshot) {
      snapshots.set(id, snapshot);
      const set = listeners.get(id);
      if (!set) return;
      for (const listener of set) listener();
    },
    subscriberCount(id) {
      return listeners.get(id)?.size ?? 0;
    },
  };
}
