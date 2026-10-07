import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as modulo from "./icones";
import { ESPESSURA_DO_TRACO, TAMANHOS_DE_ICONE, type Icone } from "./icones";

const icones = Object.entries(modulo).filter(
  (par): par is [string, Icone] => typeof par[1] === "function" && /^[A-Z]/.test(par[0]),
);

/** Com `absoluteStrokeWidth` o atributo sai escalado: 1,8px visuais em grade 24. */
const atributoEsperado = (tamanho: number) => (ESPESSURA_DO_TRACO * 24) / tamanho;

describe("ícones", () => {
  it("exporta o conjunto que a v1 precisa", () => {
    expect(icones.length).toBeGreaterThanOrEqual(35);
  });

  it.each(icones)("%s renderiza com traço de 1,8px visuais e escondido do leitor de tela", (_nome, Icone) => {
    for (const tamanho of TAMANHOS_DE_ICONE) {
      const html = renderToStaticMarkup(createElement(Icone, { tamanho }));
      const traco = /stroke-width="([\d.]+)"/.exec(html)?.[1];
      expect(Number(traco)).toBeCloseTo(atributoEsperado(tamanho), 5);
      expect(html).toContain(`width="${tamanho}"`);
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it("padrão é 16 e aria-label revela o ícone para o leitor de tela", () => {
    const Mais = modulo.Mais;
    expect(renderToStaticMarkup(createElement(Mais))).toContain('width="16"');
    const rotulado = renderToStaticMarkup(createElement(Mais, { "aria-label": "Adicionar" }));
    expect(rotulado).not.toContain("aria-hidden");
  });

  it("tamanho fora dos quatro do design system é erro de tipo", () => {
    // @ts-expect-error 17 não é 14, 16, 18 nem 20.
    createElement(modulo.Mais, { tamanho: 17 });
    // @ts-expect-error `size` do pacote não é repassado; o nome aqui é `tamanho`.
    createElement(modulo.Mais, { size: 16 });
    // @ts-expect-error o traço é fixo.
    createElement(modulo.Mais, { strokeWidth: 3 });
    expect(true).toBe(true);
  });
});
