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

    /**
     * Esquece a entrada.
     *
     * ⚠ **Existe porque nem todo estado efêmero é de vida longa.** Presença e
     * "quem está falando" são de gente, e o conjunto de gente que uma sessão
     * vê é limitado; progresso de upload é de EVENTO, e uma sessão de 8h com
     * muitos envios acumularia uma entrada por arquivo para sempre — o erro
     * nº 5 do briefing, que só aparece na sexta hora.
     *
     * Avisa como o `set`: quem assina precisa saber que o valor sumiu, senão
     * o cartão de progresso fica na tela depois de o upload terminar.
     */
    apagar(id: string) {
      if (!values.delete(id)) return;
      dirty.add(id);
      timer ??= setTimeout(flush, THROTTLE_MS);
    },

    /**
     * Esquece TUDO — o fim de um ciclo inteiro, não de uma entrada.
     *
     * ⚠ **Existe porque `faixasDeVideo` sobrevivia à chamada.** Sair de uma
     * sala zerava o store de chamada e deixava toda faixa de vídeo no lugar:
     * a sua e a de todo mundo, por chave `usuário:fonte`. Duas consequências,
     * e a segunda é pior que o vazamento.
     *
     * A primeira é o erro nº 5 do briefing — referência de `MediaStreamTrack`
     * segurada para sempre, uma por pessoa por fonte por chamada, numa sessão
     * que fica aberta oito horas.
     *
     * A segunda: as chaves são estáveis entre chamadas. Voltar para a mesma
     * sala com as mesmas pessoas reencontra as faixas MORTAS da chamada
     * anterior, e o ladrilho monta um `<video>` congelado no último quadro de
     * antes — sem erro, e parecendo que a pessoa está transmitindo agora.
     *
     * ⚠ **Avisa quem assinava, e por isso não basta um `values.clear()`.** Sem
     * a notificação, o `<video>` que já estava montado ficaria com o
     * `srcObject` antigo até alguém re-renderizar por outro motivo.
     */
    limpar() {
      if (values.size === 0) return;
      for (const id of values.keys()) dirty.add(id);
      values.clear();
      timer ??= setTimeout(flush, THROTTLE_MS);
    },
  };
}
