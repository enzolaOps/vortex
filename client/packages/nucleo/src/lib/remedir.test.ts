import { Virtualizer } from "@tanstack/react-virtual";
import { describe, expect, it } from "vitest";

import { remedir } from "./remedir";

/*
  O virtualizador DE VERDADE, sem container de rolagem: o que se prova aqui é o
  cache de tamanhos, que não depende de layout. A altura "real" de cada linha
  vem de `data-h` porque jsdom não tem engine de layout — é exatamente o papel
  do `offsetHeight` na lista.
*/
const ESTIMATIVA = 48;
const REAIS = [105, 69, 56];

function montar() {
  const v = new Virtualizer<HTMLElement, HTMLElement>({
    count: REAIS.length,
    getScrollElement: () => null,
    estimateSize: () => ESTIMATIVA,
    scrollToFn: () => {},
    observeElementRect: () => () => {},
    observeElementOffset: () => () => {},
    measureElement: (el) => Number(el.dataset.h),
  });
  // As medições são preguiçosas; sem calculá-las, `resizeItem` não acha a
  // linha. Na lista quem faz isto é o render.
  v.getTotalSize();
  const nos = REAIS.map((h, i) => {
    const el = document.createElement("div");
    el.dataset.index = String(i);
    el.dataset.h = String(h);
    document.body.appendChild(el);
    v.measureElement(el);
    return el;
  });
  // E recalculá-las DEPOIS de medir, como o render seguinte faz. Sem isto o
  // teste mentia: as medições internas ficavam na estimativa, e um `remedir`
  // sem o recálculo passava aqui e falhava no navegador.
  v.getTotalSize();
  return { v, nos };
}

/*
  O tamanho com que o virtualizador POSICIONA cada linha: o medido, e na falta
  dele a estimativa. O total confere que é isto mesmo que ele soma.
*/
function tamanhos(v: Virtualizer<HTMLElement, HTMLElement>) {
  const porLinha = REAIS.map((_, i) => v.itemSizeCache.get(i) ?? ESTIMATIVA);
  expect(v.getTotalSize()).toBe(porLinha.reduce((a, b) => a + b, 0));
  return porLinha;
}

describe("remedir", () => {
  it("parte das linhas medidas, não da estimativa", () => {
    const { v } = montar();
    expect(tamanhos(v)).toEqual(REAIS);
  });

  it("depois de remedir, as linhas montadas seguem com a altura REAL", () => {
    const { v } = montar();
    remedir(v);
    expect(tamanhos(v)).toEqual(REAIS);
  });

  it("acompanha a altura nova quando a linha mudou de forma", () => {
    const { v, nos } = montar();
    nos[1]!.dataset.h = "90";
    remedir(v);
    expect(tamanhos(v)).toEqual([105, 90, 56]);
  });

  it("não mede nó desconectado (mediria zero)", () => {
    const { v, nos } = montar();
    nos[2]!.remove();
    nos[2]!.dataset.h = "0";
    remedir(v);
    expect(tamanhos(v)[2]).toBe(ESTIMATIVA);
  });

  /*
    A razão de o módulo existir, documentada como teste: o `measure()` cru
    devolve TODAS as linhas montadas à estimativa. Se o TanStack um dia passar
    a remedir sozinho, este teste falha e `remedir` vira cerimônia.
  */
  it("o measure() cru, sozinho, devolve as linhas à estimativa", () => {
    const { v } = montar();
    // eslint-disable-next-line no-restricted-syntax -- é o comportamento que se documenta
    v.measure();
    expect(tamanhos(v)).toEqual(REAIS.map(() => ESTIMATIVA));
  });
});
