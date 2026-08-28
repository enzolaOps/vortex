import { describe, expect, it } from "vitest";

import { verdict, type FrameReport } from "./frames";

/**
 * A equivalência entre `p95 ≤ 16,7ms` e `perdidos ≤ 5%`.
 *
 * O critério foi REESCRITO, não afrouxado, e a diferença entre as duas coisas
 * é exatamente o que este arquivo guarda. Sem teste, "é equivalente, confia"
 * vira licença para o próximo ajuste ser afrouxamento de verdade.
 *
 * A equivalência é aritmética: o 95º percentil dentro de 16,7ms significa que
 * no máximo 5% dos deltas passam de 16,7ms. Os casos abaixo constroem
 * distribuições onde os dois critérios têm que concordar — inclusive na
 * fronteira, e inclusive quando a quantização do vsync faz o percentil saltar.
 */
function relatorio(deltas: number[]): FrameReport {
  const sorted = [...deltas].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.floor(sorted.length * q)] ?? 0;
  const intervalo = Math.max(at(0.01), 1);
  return {
    seconds: 30,
    frames: deltas.length,
    fps: 60,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    worst: sorted.at(-1) ?? 0,
    dropped: deltas.filter((d) => d > 16.7).length,
    longTasks: 0,
    longTaskMs: 0,
    longTasksAquecimento: 0,
    longTaskAquecimentoMs: 0,
    suspended: 0,
    intervalo,
    p95EmIntervalos: at(0.95) / intervalo,
    intervalos: { um: 0, dois: 0, tres: 0, quatroOuMais: 0 },
  };
}

/** 160Hz: os deltas só podem ser múltiplos de 6,25ms. */
function a160Hz(rapidos: number, dobrados: number, triplos: number) {
  return [
    ...Array<number>(rapidos).fill(6.25),
    ...Array<number>(dobrados).fill(12.5),
    ...Array<number>(triplos).fill(18.75),
  ];
}

describe("o critério reescrito concorda com o antigo", () => {
  it("4% de frames perdidos: os dois aprovam", () => {
    const r = relatorio(a160Hz(900, 60, 40));
    expect(r.dropped / r.frames).toBeCloseTo(0.04);
    expect(r.p95).toBeLessThanOrEqual(16.7);
    expect(verdict(r, { throttled: true }).pass).toBe(true);
  });

  it("6% de frames perdidos: os dois reprovam", () => {
    const r = relatorio(a160Hz(880, 60, 60));
    expect(r.dropped / r.frames).toBeCloseTo(0.06);
    expect(r.p95).toBeGreaterThan(16.7);
    expect(verdict(r, { throttled: true }).pass).toBe(false);
  });

  it("na fronteira dos 5% os dois viram junto", () => {
    const abaixo = relatorio(a160Hz(901, 50, 49));
    const acima = relatorio(a160Hz(899, 50, 51));
    expect(abaixo.p95 <= 16.7).toBe(verdict(abaixo, { throttled: true }).pass);
    expect(acima.p95 <= 16.7).toBe(verdict(acima, { throttled: true }).pass);
  });

  /**
   * O ganho: contagem enxerga melhora que o percentil não enxerga.
   *
   * Duas distribuições com 29 frames de diferença — o tamanho exato do que
   * separava o gate de passar nas corridas reais. Longe da fronteira dos 95%,
   * o p95 devolve o MESMO número nas duas, porque ambas caem no degrau de
   * 18,75ms. A contagem separa, e é ela que permite saber se uma mudança
   * ajudou.
   *
   * A primeira versão deste teste escolheu números que atravessavam a
   * fronteira, e falhou com razão: EM CIMA dos 95% o percentil se mexe. Ele
   * não é cego, é de baixa resolução — e foi essa distinção que fez três A/B
   * seguidos devolverem "não mudou nada" sem que nada tivesse sido refutado.
   */
  it("longe da fronteira, percentil não vê 29 frames; contagem vê", () => {
    const a = relatorio(a160Hz(3400, 300, 270));
    const b = relatorio(a160Hz(3400, 329, 241));

    expect(a.p95).toBe(b.p95);
    expect(a.p95).toBe(18.75);
    expect(a.dropped - b.dropped).toBe(29);
  });
});

describe("os dois patamares", () => {
  it("sem throttle o teto é 1%, e 4% reprova lá", () => {
    const r = relatorio(a160Hz(900, 60, 40));
    expect(verdict(r, { throttled: true }).pass).toBe(true);
    expect(verdict(r, { throttled: false }).pass).toBe(false);
  });

  it("janela com suspensão de rAF reprova antes de qualquer número", () => {
    const r = { ...relatorio(a160Hz(1000, 0, 0)), suspended: 3 };
    expect(verdict(r, { throttled: false }).pass).toBe(false);
    expect(verdict(r, { throttled: false }).checks[0]?.ok).toBe(false);
  });
});
