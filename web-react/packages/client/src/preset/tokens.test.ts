import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { TOKENS_DE_TEMA } from "./tokens";

/**
 * A união fechada contra a fonte real.
 *
 * Sem isto, `TokenName` é uma lista escrita à mão que envelhece: alguém
 * adiciona `--vx-surface-4` na camada 1, esquece daqui, e o tema de usuário
 * simplesmente não alcança a superfície nova — sem erro, sem aviso, e com
 * cara de bug de CSS.
 *
 * A direção contrária importa mais: token de cor novo que NINGUÉM classificou
 * reprova o build. O default de uma decisão esquecida vira "pare", não
 * "vaza".
 */
const css = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");

/** Comentários fora antes do parse — a mesma armadilha do `pnpm contrast`. */
function semComentarios(texto: string): string {
  let saida = "";
  let i = 0;
  for (;;) {
    const abre = texto.indexOf("/*", i);
    if (abre === -1) return saida + texto.slice(i);
    saida += texto.slice(i, abre);
    const fecha = texto.indexOf("*/", abre + 2);
    if (fecha === -1) return saida;
    i = fecha + 2;
  }
}

/** O bloco `:root` — o tema escuro, que é o default do produto. */
function tokensDaRaiz(): Map<string, string> {
  const limpo = semComentarios(css);
  const inicio = limpo.indexOf(":root {");
  const fim = limpo.indexOf("\n}", inicio);
  const corpo = limpo.slice(inicio, fim);

  const mapa = new Map<string, string>();
  for (const [, nome, valor] of corpo.matchAll(/(--vx-[a-z0-9-]+) *: *([^;]+);/g)) {
    mapa.set(nome!, valor!.trim());
  }
  return mapa;
}

/** Cor é o que tem forma de cor. Nada de adivinhar pelo nome do token. */
function ehCor(valor: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(valor);
}

describe("TOKENS_DE_TEMA contra tokens.css", () => {
  const raiz = tokensDaRaiz();

  it("o parse encontrou a camada 1", () => {
    expect(raiz.size).toBeGreaterThan(30);
  });

  it("todo token tematizável existe no CSS", () => {
    const ausentes = TOKENS_DE_TEMA.filter((t) => !raiz.has(t));
    expect(ausentes).toEqual([]);
  });

  it("todo token tematizável é uma COR", () => {
    const naoCor = TOKENS_DE_TEMA.filter((t) => !ehCor(raiz.get(t) ?? ""));
    expect(naoCor).toEqual([]);
  });

  it("toda cor da camada 1 foi classificada", () => {
    const cores = [...raiz.entries()]
      .filter(([, valor]) => ehCor(valor))
      .map(([nome]) => nome);

    const naoClassificadas = cores.filter(
      (c) => !(TOKENS_DE_TEMA as readonly string[]).includes(c),
    );

    // Se isto reprovar: uma cor nova entrou na camada 1 e ninguém decidiu se
    // o usuário pode trocá-la. Decida — e se a resposta for não, o teste
    // precisa de uma lista de exceção explícita, não de um `filter` calado.
    expect(naoClassificadas).toEqual([]);
  });

  it("espaçamento, raio e tipo ficam de fora", () => {
    const proibidos = TOKENS_DE_TEMA.filter((t) =>
      /^--vx-(space|radius|size|leading|font|duration|ease)-/.test(t),
    );
    // Contraste é verificável; escala de espaçamento inventada pelo usuário
    // não é. Densidade, se virar feature, tem outras garantias.
    expect(proibidos).toEqual([]);
  });
});
