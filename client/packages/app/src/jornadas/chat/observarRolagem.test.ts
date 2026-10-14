import { observeElementOffset, type Virtualizer } from "@tanstack/react-virtual";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { observarRolagem } from "./observarRolagem";

/**
 * A corrida do salto, sem navegador: um `scroll` em 7161, depois uma escrita programática em
 * 1315 cujo `scroll` ainda não veio quando o relógio de "parou de rolar" dispara.
 */

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function cenario(observar: typeof observeElementOffset) {
  const el = Object.assign(new EventTarget(), { scrollTop: 0, scrollLeft: 0 });
  const instancia = {
    scrollElement: el,
    targetWindow: globalThis,
    options: { horizontal: false, isRtl: false, useScrollendEvent: false, isScrollingResetDelay: 150 },
  } as unknown as Virtualizer<Element, Element>;
  const avisos: [number, boolean][] = [];
  const desligar = observar(instancia, (posicao, rolando) => avisos.push([posicao, rolando]));

  el.scrollTop = 7161;
  el.dispatchEvent(new Event("scroll"));
  // O salto escreve; o `scroll` dele só viria no próximo quadro, que a CPU atrasou.
  el.scrollTop = 1315;
  vi.advanceTimersByTime(200);
  desligar?.();
  return avisos;
}

describe("observarRolagem", () => {
  it("o padrão do TanStack relata a posição do ÚLTIMO evento ao parar (a causa)", () => {
    expect(cenario(observeElementOffset)).toEqual([
      [7161, true],
      [7161, false],
    ]);
  });

  it("aqui o aviso de parada relê o elemento", () => {
    expect(cenario(observarRolagem)).toEqual([
      [7161, true],
      [1315, false],
    ]);
  });
});
