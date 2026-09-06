import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as icones from "./icones";
import {
  CONTORNO,
  FORA_DA_ESCALA,
  ICONE,
  pareamento,
  type PropsDeIcone,
} from "./icones";

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
const css = readFileSync(
  new URL("../../styles/tokens.css", import.meta.url),
  "utf8",
);

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

/**
 * As regras de CSS que dimensionam ícone.
 *
 * ⚠ **A escala do TSX não alcança o CSS, e é lá que a maioria dos ícones deste
 * app é dimensionada** — 42 regras contra os poucos `size={}` que sobraram.
 * Sem esta varredura a escala vale para a minoria e o resto flutua.
 *
 * Ela achou, na primeira corrida: quatro regras dizendo tamanho de ícone com a
 * escala de ESPAÇO (`--vx-space-12` — 12px, valor certo e vocabulário errado)
 * e um `11px` sem razão nenhuma escrita.
 */
type RegraDeIcone = { arquivo: string; sel: string; valor: string };

function regrasQueDimensionamSvg(): RegraDeIcone[] {
  const achados: RegraDeIcone[] = [];

  const visitar = (dir: URL): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const filho = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
      if (e.isDirectory()) {
        visitar(filho);
        continue;
      }
      if (!e.name.endsWith(".module.css")) continue;

      const texto = readFileSync(filho, "utf8");
      for (const m of texto.matchAll(/([^{}/]+?)\{([^}]*)\}/g)) {
        const sel = (m[1] ?? "").split("*/").pop()?.trim() ?? "";
        if (!sel || !sel.includes("svg")) continue;
        const largura = /inline-size:\s*([^;]+);/.exec(m[2] ?? "");
        if (!largura?.[1]) continue;
        achados.push({
          arquivo: decodeURIComponent(filho.pathname).split("/src/")[1] ?? e.name,
          sel: sel.split(/\s+/).join(" "),
          valor: largura[1].trim(),
        });
      }
    }
  };

  visitar(new URL("../../", import.meta.url));
  return achados;
}

describe("o CSS dimensiona ícone dentro da escala", () => {
  const regras = regrasQueDimensionamSvg();
  const degraus: ReadonlySet<string> = new Set(
    Object.values(pareamento)
      .filter((p) => p !== null)
      .map((p) => `var(${p})`),
  );

  /**
   * ⚠ **A guarda contra a guarda.** A primeira versão desta varredura tinha um
   * `\b` que virou um caractere BACKSPACE literal no arquivo, então a regex
   * era `/\x08inline-size…/` e nunca casava — ela relatou "tudo certo" tendo
   * lido 100 módulos e achado zero regras. Uma varredura que aprova o vazio é
   * pior que nenhuma, porque ninguém a olha de novo.
   */
  it("a varredura encontra regras (senão ela aprova o vazio)", () => {
    expect(regras.length).toBeGreaterThan(20);
  });

  it("nenhuma regra dimensiona ícone com valor fora da escala", () => {
    const fugitivas = regras
      .filter((r) => !degraus.has(r.valor))
      .filter((r) => !FORA_DA_ESCALA.some((e) => `${r.arquivo} ${r.sel}` === e.onde))
      .map((r) => `${r.arquivo}  ${r.sel}  ->  ${r.valor}`);
    expect(fugitivas).toEqual([]);
  });

  /**
   * ⚠ A direção que impede a lista de virar depósito: exceção que voltou para
   * a escala precisa SAIR, senão ela mente sobre uma decisão que ninguém
   * tomou mais. Mesmo par de asserções de `SEM_PAR` no contraste.
   */
  it.each(FORA_DA_ESCALA.filter((e) => e.onde.includes("svg")))(
    "a exceção $onde ainda existe e ainda está fora da escala",
    ({ onde, px }) => {
      const r = regras.find((x) => `${x.arquivo} ${x.sel}` === onde);
      expect(r, `a regra de ${onde} sumiu — tire a exceção`).toBeDefined();
      expect(r?.valor).toBe(`${px}px`);
    },
  );

  it("toda exceção diz por quê, e não com uma frase de enfeite", () => {
    for (const e of FORA_DA_ESCALA) {
      expect(e.porque.length, `${e.onde} sem razão de verdade`).toBeGreaterThan(60);
    }
  });
});

/**
 * A classificação sólido × contorno tem de cobrir TODO ícone exportado.
 *
 * ⚠ **Sem isto, ícone novo entra em `fill` por omissão** — e `fill` é o peso
 * que muda a FORMA de um `X`, de um `+` e de um `#`. O default de uma decisão
 * esquecida seria a versão errada do ícone mais usado da tela, sem nada
 * falhar. É a mesma mecânica de `ModalId`, `PainelId` e `TokenName`: o
 * conjunto é fechado e conferido nos dois sentidos.
 */
describe("todo ícone está classificado", () => {
  const fonte = readFileSync(
    new URL("./icones.tsx", import.meta.url),
    "utf8",
  );

  const exportados = [
    ...fonte.matchAll(/^export const ([A-Z][A-Za-z]*) = /gm),
  ].map((m) => m[1] as string);

  it("a varredura acha os ícones (senão ela aprova o vazio)", () => {
    expect(exportados.length).toBeGreaterThan(70);
  });

  it.each([...CONTORNO])("%s está exportado", (nome) => {
    expect(exportados).toContain(nome);
  });
});

/**
 * Ícone sem `size` NÃO pode chegar ao DOM com um número.
 *
 * ⚠ **Este teste existe porque a ausência de dono deixou de ser detectável e
 * nada acusou.** `dev/tamanhoDeIcone.ts` decide se a prop mente lendo o
 * atributo `width` do `svg`, e trata `1em` como "ninguém pediu tamanho" — o
 * sentinela que o `IconContext.Provider` do Phosphor produzia. A troca para
 * `@remixicon/react` apagou esse provider junto com o arquivo que o
 * sustentava, e o pacote passou a estampar o PRÓPRIO padrão: `size = 24`,
 * escrito como `width`/`height` no elemento.
 *
 * O efeito tem duas metades, e a segunda é a pior:
 *
 * - **87 instâncias** voltaram a ter dois donos — o `svg` afirmando 24px
 *   enquanto `.sm svg { inline-size: 13px }` desenhava 13. Nenhuma delas foi
 *   escrita por quem chama: os call sites reais dizem 18, 16 ou 14, e que os
 *   87 relatassem o MESMO número é a assinatura de origem única.
 * - **o ramo "nenhum dono" da assertion ficou inalcançável**, porque todo
 *   `svg` passou a ter prop. Ela seguia rodando, verde, sem poder reprovar —
 *   "medir com o instrumento desligado", desta vez com a guarda no lugar do
 *   ambiente.
 *
 * Por que teste e não a própria assertion: a ordem do projeto põe teste acima
 * de assertion em dev, e o defeito aqui é do CONTRATO do wrapper, que não
 * precisa de navegador para ser conferido. Uma troca de biblioteca de ícone
 * quebra este arquivo no `pnpm check`, antes de qualquer tela.
 */
describe("o wrapper não deixa a biblioteca estampar um tamanho", () => {
  const componentes = Object.entries(
    icones as unknown as Record<string, unknown>,
  ).filter(
    ([nome, valor]) => typeof valor === "function" && /^[A-Z]/.test(nome),
  ) as [string, ComponentType<PropsDeIcone>][];

  it("a varredura acha os componentes (senão ela aprova o vazio)", () => {
    expect(componentes.length).toBeGreaterThan(70);
  });

  it.each(componentes)("%s sem size sai em 1em, não no padrão do pacote", (
    _nome,
    Componente,
  ) => {
    const html = renderToStaticMarkup(createElement(Componente));
    expect(html).toContain('width="1em"');
    expect(html).toContain('height="1em"');
  });

  it("quem PEDE um tamanho continua sendo obedecido", () => {
    const [, Primeiro] = componentes[0] as [
      string,
      ComponentType<PropsDeIcone>,
    ];
    const html = renderToStaticMarkup(
      createElement(Primeiro, { size: ICONE.controle }),
    );
    expect(html).toContain(`width="${ICONE.controle}"`);
  });
});
