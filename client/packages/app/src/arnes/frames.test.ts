import { describe, expect, it } from "vitest";

import { estimarIntervalo, verdict, type FrameReport } from "./frames";

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
  const intervalo = estimarIntervalo(sorted);
  return {
    seconds: 30,
    frames: deltas.length,
    fps: 60,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    worst: sorted.at(-1) ?? 0,
    subIntervalo: sorted.filter((d) => d < intervalo * 0.9).length,
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

/**
 * O estimador de intervalo de vsync.
 *
 * Escrito DEPOIS de o antigo falhar em produção, e com o caso real dele como
 * primeiro teste: numa corrida do gate ele devolveu 4ms num display de 164Hz,
 * o que é mais curto que um vsync e portanto impossível. O estrago apareceu na
 * distribuição — 2156 frames migraram do balde "1×" para o "2×" sem que nada
 * tivesse mudado no código.
 */
describe("estimador de intervalo", () => {
  /** Um display de 164Hz: 6,1ms de vsync, com jitter de décimos. */
  const vsync = (n: number, mult = 1) =>
    Array.from({ length: n }, (_, i) => 6.1 * mult + ((i % 5) - 2) * 0.05);

  it("acerta o vsync num app saudável", () => {
    const d = [...vsync(950), ...vsync(50, 2)];
    expect(estimarIntervalo([...d].sort((a, b) => a - b))).toBeCloseTo(6.1, 1);
  });

  it("acerta mesmo quando a MEDIANA já é dois intervalos", () => {
    /*
      O caso que derrubaria uma estimativa por mediana, e a razão pela qual o
      método antigo olhava para o começo da distribuição. App engasgado: a
      maioria dos frames perde um vsync, mas o intervalo do display não mudou.
    */
    const d = [...vsync(300), ...vsync(700, 2)];
    expect(estimarIntervalo([...d].sort((a, b) => a - b))).toBeCloseTo(6.1, 1);
  });

  it("descarta a RAJADA sub-vsync — o caso que quebrou o antigo", () => {
    /*
      40 deltas de ~4ms em ~3470 amostras: 1,2%, o suficiente para arrastar o
      1º percentil e nem perto de ser onde os frames pousam.

      Quarenta e não trinta e quatro, e o teste pegou esse erro: o 1º
      percentil de 3432 amostras é o ÍNDICE 34, que é o 35º menor valor. Com
      34 deltas o método antigo já escapava.
    */
    const d = [
      ...Array.from({ length: 40 }, () => 4),
      ...vsync(373),
      ...vsync(2156, 2),
      ...vsync(657, 3),
      ...vsync(246, 4),
    ];
    const ordenados = [...d].sort((a, b) => a - b);

    // O método antigo, para deixar a diferença explícita no teste.
    const antigo = ordenados[Math.floor(ordenados.length * 0.01)]!;
    expect(antigo).toBe(4);

    expect(estimarIntervalo(ordenados)).toBeCloseTo(6.1, 1);
  });

  it("uma rajada GRANDE não é descartada — ela deixa de ser rajada", () => {
    /*
      O outro lado, e é o que impede o piso de virar um filtro que esconde
      display rápido de verdade. Se 20% dos frames medem 4ms, então 4ms É o
      vsync desta máquina, e o estimador tem que segui-la.
    */
    const d = [
      ...Array.from({ length: 200 }, (_, i) => 4 + ((i % 5) - 2) * 0.05),
      ...vsync(800),
    ];
    expect(estimarIntervalo([...d].sort((a, b) => a - b))).toBeCloseTo(4, 1);
  });

  it("distribuição sem aglomerado nenhum não inventa número", () => {
    // Cem deltas todos diferentes: nenhum balde alcança o piso de 2%, e o
    // estimador cai no menor valor em vez de escolher um balde por sorte.
    const d = Array.from({ length: 100 }, (_, i) => 3 + i * 0.7);
    expect(estimarIntervalo([...d].sort((a, b) => a - b))).toBeCloseTo(3, 1);
  });
});
