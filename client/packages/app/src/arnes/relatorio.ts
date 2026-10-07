import type { Counters } from "nucleo/arnes/stats";

import type { RelatorioDoGate } from "./contrato";
import { verdict, type FrameReport } from "./frames";

/** Corrida que entrega menos que isto da carga pedida mediu um app sob MENOS carga do que o gate anuncia. */
export const PISO_DE_VAZAO = 0.9;
/** Mais longe do fim que isto = a lista parou de seguir, e a corrida mediu uma lista parada. */
export const LIMITE_DE_DISTANCIA_DO_FIM = 120;

export interface EntradaDoRelatorio {
  frames: FrameReport;
  contadores: Counters;
  throttled: boolean;
  eventosPorSegundo: number;
  mensagens: number;
  distanciaDoFim: number | null;
}

/**
 * Fecha uma janela de medição em veredito. Duas camadas, e a ordem importa:
 * primeiro a VALIDADE (a corrida mediu o que diz medir?), depois o critério.
 * Inválida não é PASS nem FAIL: PASS sem dados é pior que não ter gate.
 */
export function montarRelatorio(e: EntradaDoRelatorio): RelatorioDoGate {
  const vazao = Math.round((e.contadores.eventos ?? 0) / Math.max(e.frames.seconds, 1));
  const { checks, pass } = verdict(e.frames, { throttled: e.throttled });

  let motivoInvalido: string | undefined;
  if (e.frames.frames === 0) {
    motivoInvalido = "nenhum frame medido (a aba não compôs; rAF suspenso)";
  } else if (vazao < e.eventosPorSegundo * PISO_DE_VAZAO) {
    const pct = Math.round((vazao / e.eventosPorSegundo) * 100);
    motivoInvalido =
      `o gerador entregou ${vazao} de ${e.eventosPorSegundo} ev/s (${pct}%, piso de ${PISO_DE_VAZAO * 100}%): ` +
      `o app foi medido sob menos carga do que o gate afirma cobrar`;
  } else if (e.distanciaDoFim === null) {
    motivoInvalido = "a lista de mensagens não estava na tela";
  } else if (e.distanciaDoFim > LIMITE_DE_DISTANCIA_DO_FIM) {
    motivoInvalido = `lista a ${e.distanciaDoFim}px do fim: followOnAppend desligado, a corrida mediu uma lista parada`;
  }

  return {
    veredito: motivoInvalido !== undefined ? "INVALIDA" : pass ? "PASS" : "FAIL",
    ...(motivoInvalido !== undefined ? { motivoInvalido } : {}),
    condicao: {
      throttled: e.throttled,
      eventosPorSegundo: e.eventosPorSegundo,
      mensagens: e.mensagens,
    },
    frames: e.frames,
    contadores: e.contadores,
    vazao,
    distanciaDoFim: e.distanciaDoFim,
    checks,
  };
}
