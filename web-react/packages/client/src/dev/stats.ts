/**
 * Contadores de diagnóstico.
 *
 * O gate diz SE passou. Isto diz ONDE o tempo foi — sem um profiler aberto e
 * sem depender de palpite. Some do bundle de produção junto com o resto de
 * `dev/`.
 */
export type Counters = {
  /** Publicações da lista de IDs (uma por frame, no máximo). */
  publishes: number;
  /** Custo acumulado dentro do flush de publicação — a cópia do array. */
  publishMs: number;
  /** Renders do MessageList. É o componente que o React Compiler NÃO memoiza. */
  listRenders: number;
  /** Renders de linha. Deveria acompanhar só as mensagens que mudaram. */
  rowRenders: number;
  /** Renders do ponto de presença. Isolado da linha de propósito. */
  presenceRenders: number;
  /** Snapshots de mensagem construídos pelo adapter. */
  snapshots: number;
  /** Custo do PRÓPRIO gerador do firehose — para atribuir long tasks. */
  tickMs: number;
  maxTickMs: number;
};

const zero = (): Counters => ({
  publishes: 0,
  publishMs: 0,
  listRenders: 0,
  rowRenders: 0,
  presenceRenders: 0,
  snapshots: 0,
  tickMs: 0,
  maxTickMs: 0,
});

let counters = zero();
let collecting = false;

export function resetCounters() {
  counters = zero();
  collecting = true;
}

export function readCounters(): Counters {
  collecting = false;
  return { ...counters, publishMs: Number(counters.publishMs.toFixed(1)) };
}

export function count(key: keyof Counters, amount = 1) {
  if (collecting) counters[key] += amount;
}

export function countMax(key: keyof Counters, value: number) {
  if (collecting && value > counters[key]) counters[key] = value;
}
