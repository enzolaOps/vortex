/**
 * Estado efêmero: typing, presença, quem está falando.
 *
 * Volume alto, superfície visual minúscula. Fica FORA do store de mensagens —
 * um servidor grande emite centenas de eventos de presença por segundo, e
 * misturar isso com mensagens acorda a lista inteira a cada piscada.
 *
 * O throttle vive aqui, na fronteira do adapter, e não no componente. Coalescer
 * em janelas de ~120ms é invisível para o usuário e derruba o custo em uma
 * ordem de grandeza.
 */

const THROTTLE_MS = 120;

type Listener = () => void;

export function createEphemeralStore<T>() {
  const values = new Map<string, T>();
  const listeners = new Map<string, Set<Listener>>();
  const subscribers = new Map<string, (listener: Listener) => () => void>();
  const dirty = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function flush() {
    timer = undefined;
    for (const id of dirty) {
      const set = listeners.get(id);
      if (!set) continue;
      for (const listener of set) listener();
    }
    dirty.clear();
  }

  return {
    subscriber(id: string) {
      let bound = subscribers.get(id);
      if (!bound) {
        bound = (listener: Listener) => {
          let set = listeners.get(id);
          if (!set) {
            set = new Set();
            listeners.set(id, set);
          }
          set.add(listener);
          return () => {
            const current = listeners.get(id);
            if (!current) return;
            current.delete(listener);
            if (current.size === 0) listeners.delete(id);
          };
        };
        subscribers.set(id, bound);
      }
      return bound;
    },

    getSnapshot(id: string): T | undefined {
      return values.get(id);
    },

    /** Escreve já, avisa em lote. O valor mais recente sempre vence. */
    set(id: string, value: T) {
      values.set(id, value);
      dirty.add(id);
      timer ??= setTimeout(flush, THROTTLE_MS);
    },
  };
}
