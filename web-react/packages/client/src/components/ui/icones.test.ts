import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { ICONE, pareamento } from "./icones";

/**
 * A escala de ícone existe DUAS vezes — `--vx-icon-*` no `tokens.css` e
 * `ICONE` no TSX — e este teste é o único motivo para isso ser seguro.
 *
 * ⚠ **Sem ele a divergência é silenciosa e assimétrica.** Mexer no CSS não
 * quebra nada em TypeScript, e mexer no TS não quebra CSS nenhum: os dois
 * compilam, os dois passam no lint, e o sintoma é um ícone de 14 ao lado de um
 * de 16 numa barra — exatamente o defeito que a escala foi criada para acabar.
 *
 * Lê o `tokens.css` de verdade, nunca uma cópia. É o mesmo princípio do
 * `contraste.test.ts`: cópia envelhece e passa a aprovar o que não existe.
 */
const css = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");

function degrausDoCss(): Map<string, number> {
  const achados = new Map<string, number>();
  for (const m of css.matchAll(/^\s*(--vx-icon-\d+)\s*:\s*(\d+)px\s*;/gm)) {
    const [, nome, valor] = m;
    if (nome && valor) achados.set(nome, Number(valor));
  }
  return achados;
}

describe("a escala de ícone é uma só", () => {
  const doCss = degrausDoCss();

  it("o tokens.css declara a escala que o pareamento pressupõe", () => {
    expect(doCss.size).toBeGreaterThan(0);
  });

  it.each(Object.entries(pareamento))(
    "ICONE.%s bate com a custom property que ele diz ser",
    (nome, prop) => {
      const valor = ICONE[nome as keyof typeof ICONE];
      if (prop === null) {
        // Degrau sem par: nenhuma var do CSS pode carregar o mesmo número,
        // senão o par existe e alguém esqueceu de escrevê-lo.
        expect([...doCss.values()]).not.toContain(valor);
        return;
      }
      expect(doCss.has(prop), `${prop} sumiu do tokens.css`).toBe(true);
      expect(doCss.get(prop)).toBe(valor);
    },
  );

  it("todo degrau de --vx-icon-* tem nome deste lado", () => {
    const pareados: ReadonlySet<string> = new Set(
      Object.values(pareamento).filter((p) => p !== null),
    );
    expect([...doCss.keys()].filter((p) => !pareados.has(p))).toEqual([]);
  });

  it("todo nome deste lado está no pareamento", () => {
    expect(Object.keys(ICONE).sort()).toEqual(Object.keys(pareamento).sort());
  });

  /**
   * ⚠ **A trava que impede o degrau ressuscitado.** Um número repetido entre
   * dois nomes faz `metadado` e `selo` valerem o mesmo, e aí a escolha entre
   * eles deixa de significar coisa alguma sem nada falhar.
   */
  it("nenhum degrau repete o valor de outro", () => {
    const valores = Object.values(ICONE);
    expect(new Set(valores).size).toBe(valores.length);
  });
});
