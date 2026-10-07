import { seed, startFirehose } from "nucleo/arnes/firehose";
import { readCounters, resetCounters } from "nucleo/arnes/stats";

import type { OpcoesDoFirehose, RelatorioDoGate, VortexGate } from "./contrato";
import { createFrameRecorder } from "./frames";
import { montarRelatorio } from "./relatorio";

const EVENTOS_POR_SEGUNDO = 500;
const AQUECIMENTO_S = 1.5;

/** Distância da lista de mensagens até o fim; `null` se ela não está na tela. */
function distanciaDoFim(): number | null {
  const el = document.querySelector('[role="log"]');
  return el ? Math.round(el.scrollHeight - el.clientHeight - el.scrollTop) : null;
}

/**
 * O estado e a API do gate. O arnês publica isto em `window.__vortexGate`, e os
 * botões da tela chamam as MESMAS funções: uma corrida manual em display real e
 * uma corrida do `gate.mjs` medem a mesma coisa.
 */
export interface EstadoDoGate {
  readonly semeadas: number;
  readonly semeando: boolean;
  readonly medindo: boolean;
  readonly relatorio: RelatorioDoGate | null;
}

export function criarGate() {
  const gravador = createFrameRecorder();
  const ouvintes = new Set<() => void>();
  let ids: readonly string[] = [];
  let semeando = false;
  let parar: (() => void) | undefined;
  let opcoesAtuais: Required<OpcoesDoFirehose> | undefined;
  let ultimo: RelatorioDoGate | null = null;
  let zerar = 0;

  // Retrato imutável, trocado a cada transição: é o `getSnapshot` do
  // `useSyncExternalStore` (referência estável entre mudanças).
  const retrato = (): EstadoDoGate => ({
    semeadas: ids.length,
    semeando,
    medindo: parar !== undefined,
    relatorio: ultimo,
  });
  let atual: EstadoDoGate = retrato();
  const mudou = () => {
    atual = retrato();
    for (const o of ouvintes) o();
  };

  const api: VortexGate = {
    async semear(n) {
      semeando = true;
      mudou();
      try {
        ids = await seed(n);
        return ids.length;
      } finally {
        semeando = false;
        mudou();
      }
    },

    firehose(ligado, opcoes) {
      if (ligado) {
        if (parar) return;
        if (ids.length === 0) throw new Error("semeie antes de ligar o firehose");
        if (!opcoes) throw new Error("declare a condição: firehose(true, { throttled })");
        opcoesAtuais = {
          throttled: opcoes.throttled,
          eventosPorSegundo: opcoes.eventosPorSegundo ?? EVENTOS_POR_SEGUNDO,
          aquecimento: opcoes.aquecimento ?? AQUECIMENTO_S,
        };
        parar = startFirehose(opcoesAtuais.eventosPorSegundo, ids);
        // Aquecimento descartado; os contadores só começam depois dele.
        gravador.start(opcoesAtuais.aquecimento * 1000);
        zerar = window.setTimeout(() => {
          resetCounters();
        }, opcoesAtuais.aquecimento * 1000);
        ultimo = null;
      } else {
        if (!parar || !opcoesAtuais) return;
        clearTimeout(zerar);
        parar();
        parar = undefined;
        const frames = gravador.stop();
        ultimo = montarRelatorio({
          frames,
          contadores: readCounters(),
          throttled: opcoesAtuais.throttled,
          eventosPorSegundo: opcoesAtuais.eventosPorSegundo,
          mensagens: ids.length,
          distanciaDoFim: distanciaDoFim(),
        });
        opcoesAtuais = undefined;
      }
      mudou();
    },

    relatorio: () => ultimo,
  };

  return {
    api,
    /** Para `useSyncExternalStore`: muda a cada transição de estado. */
    assinar: (f: () => void) => {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    snapshot: () => atual,
  };
}
