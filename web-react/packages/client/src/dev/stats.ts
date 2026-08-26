/**
 * Contadores de diagnóstico.
 *
 * O gate diz SE passou. Isto diz ONDE o tempo foi — sem um profiler aberto e
 * sem depender de palpite. Some do bundle de produção junto com o resto de
 * `dev/`.
 */
export type Counters = {
  /** Publicações da lista de IDs de MENSAGEM (uma por frame, no máximo). */
  publishes: number;
  /** Custo acumulado dentro do flush de publicação — a cópia do array. */
  publishMs: number;
  /**
   * Publicações da member list, contadas em SEPARADO.
   *
   * Na primeira corrida depois da fase 3 elas estavam somadas às de canal, e o
   * relatório virou um número que não atribuía nada: 131 publicações custando
   * 78,4ms, sem dizer quanto era lista de mensagem e quanto era reordenação de
   * membro. Contador compartilhado entre dois caminhos diferentes não é
   * contador, é média.
   */
  membrosPublishes: number;
  membrosPublishMs: number;
  /** Renders da ListaDeMembros — o componente que o compiler NÃO memoiza. */
  membrosListRenders: number;
  /** Renders de linha de membro. Deveria acompanhar só quem mudou de balde. */
  membrosRowRenders: number;
  /**
   * Efeitos Solid criados pelo store de MEMBRO.
   *
   * Cada `NomeDoAutor` que monta assina o autor, e o primeiro assinante de um
   * ID cria um `createRoot` + `createEffect`. Com a lista rolando, linha monta
   * e desmonta o tempo todo — se o último assinante de um autor sair e outro
   * entrar logo depois, isso vira criação e descarte de raiz Solid na
   * velocidade do scroll. Este contador é o que mostra se está acontecendo.
   */
  membroEfeitos: number;
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
  /**
   * Eventos que o gerador REALMENTE entregou na janela.
   *
   * O arnês pede 500/s e reporta o custo do gerador, mas nunca reportou a
   * vazão. `setInterval(16)` não é garantia de 62 ticks por segundo — sob
   * throttle de 4x o relógio escorrega, e um gate que entrega 250/s enquanto
   * afirma 500/s aprova metade da carga que diz aprovar.
   *
   * Custa um incremento por evento e transforma a premissa central do gate em
   * número verificável.
   */
  eventos: number;
  /**
   * Altura real das linhas visíveis, somada e contada.
   *
   * O `estimateSize` da lista era 44px desde a fase 0 e nunca foi conferido
   * contra a linha que existe hoje — com agrupamento, divisor de data e
   * estado de envio. Estimativa não medida é como se chega a errar 29px por
   * linha sem ninguém perceber por três fases.
   */
  alturaSoma: number;
  alturaAmostras: number;
};

const zero = (): Counters => ({
  publishes: 0,
  publishMs: 0,
  membrosPublishes: 0,
  membrosPublishMs: 0,
  membrosListRenders: 0,
  membrosRowRenders: 0,
  membroEfeitos: 0,
  listRenders: 0,
  rowRenders: 0,
  presenceRenders: 0,
  snapshots: 0,
  tickMs: 0,
  maxTickMs: 0,
  eventos: 0,
  alturaSoma: 0,
  alturaAmostras: 0,
});

let counters = zero();
let collecting = false;

export function resetCounters() {
  counters = zero();
  collecting = true;
}

export function readCounters(): Counters {
  collecting = false;
  return {
    ...counters,
    publishMs: Number(counters.publishMs.toFixed(1)),
    membrosPublishMs: Number(counters.membrosPublishMs.toFixed(1)),
  };
}

export function count(key: keyof Counters, amount = 1) {
  if (collecting) counters[key] += amount;
}

export function countMax(key: keyof Counters, value: number) {
  if (collecting && value > counters[key]) counters[key] = value;
}
