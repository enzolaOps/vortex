import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { TOKENS_DE_TEMA, type TokenName } from "../preset/tokens";
import { dispensado, EXCECOES, PARES, verificar } from "./pares";

/**
 * O contraste do `tokens.css`. Era `scripts/contrast.mjs`.
 *
 * A migração para teste não foi arrumação: o picker de paleta precisa
 * verificar contraste em tempo de escolha, e duas listas de pares que precisam
 * concordar sempre acabam divergindo. Alguém adiciona um par no CI e a paleta
 * escolhida pelo usuário passa a ser aprovada por uma régua mais curta — ou o
 * contrário, e o picker rejeita o que o CI aceita.
 *
 * Agora há uma lista (`pares.ts`), usada pelos dois. `pnpm contrast` continua
 * existindo e aponta para cá.
 *
 * Lê a FONTE, não uma cópia: um verificador que valida uma constante duplicada
 * aprova o que não está na tela.
 */
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

const css = semComentarios(
  readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8"),
);

function tema(seletor: string): Partial<Record<TokenName, string>> {
  const inicio = css.indexOf(seletor + " {");
  if (inicio === -1) throw new Error(`bloco não encontrado: ${seletor}`);
  const corpo = css.slice(inicio, css.indexOf("\n}", inicio));

  const mapa: Partial<Record<TokenName, string>> = {};
  for (const [, nome, valor] of corpo.matchAll(/(--vx-[a-z0-9-]+) *: *([^;]+);/g)) {
    if ((TOKENS_DE_TEMA as readonly string[]).includes(nome!)) {
      mapa[nome as TokenName] = valor!.trim();
    }
  }
  return mapa;
}

const TEMAS = [
  { nome: "escuro", seletor: ":root" },
  { nome: "claro", seletor: '[data-theme="light"]' },
] as const;

describe("contraste dos tokens", () => {
  for (const { nome, seletor } of TEMAS) {
    it(`${nome}: ${PARES.length} pares dentro do mínimo`, () => {
      const v = verificar(tema(seletor));

      /*
        Falha FORA da lista de exceções reprova, como sempre reprovou.

        A lista existe porque a paleta do design viola o mínimo em alguns pares
        e a decisão foi seguir o design exatamente. O que ela não pode virar é
        um cheque em branco: tudo o que não está enumerado continua guardado.
      */
      const detalhe = v.falhas
        .filter((f) => !dispensado(f.par, nome))
        .map((f) => `${f.par.fg} sobre ${f.par.bg} = ${f.razao.toFixed(2)}:1 (mín ${f.par.min})`)
        .join("\n");

      expect(detalhe).toBe("");

      /*
        E a direção contrária, que é a que impede a lista de virar depósito.

        Exceção que PAROU de falhar mente sobre uma decisão que ninguém tomou
        mais — e a próxima pessoa lê "o design viola aqui" sobre um par que já
        está em ordem. É o mesmo par de asserções de `SEM_PAR`, pela mesma
        razão: o default de uma decisão esquecida tem de ser "pare".
      */
      const falhando = new Set(v.falhas.map((f) => `${f.par.fg}|${f.par.bg}`));
      const obsoletas = EXCECOES.filter(
        (e) => e.modo === nome && !falhando.has(`${e.fg}|${e.bg}`),
      ).map((e) => `${e.fg} sobre ${e.bg}`);

      expect(obsoletas, `${nome}: exceção que já passa`).toEqual([]);

      /**
       * O par mais apertado, sempre impresso.
       *
       * `process.stdout.write` e não `console.info`: o vitest intercepta o
       * console e engole a linha, e foi exatamente esta linha que revelou que
       * `--vx-border-strong` passava com 3,00 exatos — folga zero, aprovado
       * por sorte. Um verificador que só diz "passou" esconde o quanto passou
       * raspando, e é aí que mora a próxima quebra.
       */
      const dispensadas = EXCECOES.filter((e) => e.modo === nome).length;
      process.stdout.write(
        `  ${nome}: ${PARES.length - dispensadas}/${PARES.length} ok, ` +
          `${dispensadas} dispensados pelo design — mais apertado ` +
          `${v.maisApertado?.par.fg} sobre ${v.maisApertado?.par.bg} = ` +
          `${v.maisApertado?.razao.toFixed(2)}:1 (mín ${v.maisApertado?.par.min})
`,
      );
    });
  }

  it("todo token tematizável aparece nos dois temas", () => {
    for (const { nome, seletor } of TEMAS) {
      const t = tema(seletor);
      const ausentes = TOKENS_DE_TEMA.filter((k) => !t[k]);
      expect(ausentes, nome).toEqual([]);
    }
  });
});
