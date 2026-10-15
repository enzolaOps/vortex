import { observeElementOffset, type Virtualizer } from "@tanstack/react-virtual";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contrato com o TanStack Virtual, não teste de código nosso.
 *
 * Até `virtual-core@3.17`, sem `scrollend` o virtualizador marcava o fim da rolagem com um
 * `setTimeout` de 150ms rearmado a cada `scroll`, e esse relógio relatava o `scrollTop` guardado
 * no ÚLTIMO evento — não o atual. Com a CPU disputada um quadro passava de 150ms e o relógio
 * disparava entre uma escrita programática (`scrollToIndex`) e o `scroll` que ela geraria: o
 * virtualizador adotava a posição de antes da escrita, a compensação de medida a escrevia de
 * volta no DOM e o salto até uma mensagem antiga parava fora da janela montada (só no Linux do
 * CI, com vários arquivos de navegador em paralelo).
 *
 * O app tinha um contorno (`observarRolagem`) que relia o elemento. A `3.19` passou a fazer o
 * mesmo dentro do `observeOffset` e o contorno foi removido. Este teste é o que impede uma
 * atualização futura de trazer o defeito de volta calada: a corrida, sem navegador — um `scroll`
 * em 7161, depois uma escrita em 1315 cujo `scroll` ainda não veio quando o relógio dispara.
 */

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("fim de rolagem do TanStack Virtual", () => {
  it("o aviso de parada relê o elemento, não a posição do último `scroll`", () => {
    const el = Object.assign(new EventTarget(), { scrollTop: 0, scrollLeft: 0 });
    const instancia = {
      scrollElement: el,
      targetWindow: globalThis,
      options: { horizontal: false, isRtl: false, useScrollendEvent: false, isScrollingResetDelay: 150 },
    } as unknown as Virtualizer<Element, Element>;
    const avisos: [number, boolean][] = [];
    const desligar = observeElementOffset(instancia, (posicao, rolando) => avisos.push([posicao, rolando]));

    el.scrollTop = 7161;
    el.dispatchEvent(new Event("scroll"));
    // O salto escreve; o `scroll` dele só viria no próximo quadro, que a CPU atrasou.
    el.scrollTop = 1315;
    vi.advanceTimersByTime(200);
    desligar?.();

    expect(avisos).toEqual([
      [7161, true],
      [1315, false],
    ]);
  });
});
