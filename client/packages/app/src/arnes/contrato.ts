import type { Counters } from "nucleo/arnes/stats";

import type { FrameReport } from "./frames";

/**
 * O contrato do gate (ADR-010): `window.__vortexGate`. O `scripts/gate.mjs` chama
 * isto em vez de raspar texto de botão, então mudar o rótulo de um botão do arnês
 * não quebra o gate em silêncio.
 */
export interface OpcoesDoFirehose {
  /** Declara a condição da corrida: ela escolhe o teto (5% com CPU 4x, 1% sem). O gate não adivinha. */
  throttled: boolean;
  /** Padrão 500. */
  eventosPorSegundo?: number;
  /** Aquecimento descartado, em segundos. Padrão 1,5. */
  aquecimento?: number;
}

export type Veredito = "PASS" | "FAIL" | "INVALIDA";

export interface RelatorioDoGate {
  veredito: Veredito;
  /** Quando INVALIDA: por quê. Corrida inválida não é nem PASS nem FAIL. */
  motivoInvalido?: string;
  condicao: { throttled: boolean; eventosPorSegundo: number; mensagens: number };
  frames: FrameReport;
  contadores: Counters;
  /** Eventos por segundo que o gerador entregou de fato. */
  vazao: number;
  /** Distância (px) da lista até o fim ao terminar. Mais que o limiar = followOnAppend desligado. */
  distanciaDoFim: number | null;
  checks: { name: string; ok: boolean; got: string }[];
}

export interface VortexGate {
  /** Semeia `n` mensagens no canal do arnês e o abre. Resolve com quantas existem. */
  semear: (n: number) => Promise<number>;
  /** `true` liga o firehose e a gravação de frames; `false` desliga e fecha o relatório. */
  firehose: (ligado: boolean, opcoes?: OpcoesDoFirehose) => void;
  /** O relatório da última janela fechada, ou `null`. */
  relatorio: () => RelatorioDoGate | null;
}

declare global {
  interface Window {
    __vortexGate?: VortexGate;
  }
}
