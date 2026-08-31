import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { TOKENS_DE_TEMA } from "../preset/tokens";
import { hexParaOklch, oklchParaHex } from "./cor";
import { derivar, LIMITES_DA_SEMENTE, SEMENTE_PADRAO, type Modo } from "./derivar";
import { falhasQueContam, verificar } from "./pares";

/**
 * A promessa do picker, e o teste que a torna verdadeira.
 *
 * A referência pede "validar contraste no momento da escolha, avisando ou
 * corrigindo antes de aplicar". A arquitetura escolhida vai além: o usuário
 * mexe em matiz e croma, o app decide toda a LUMINOSIDADE, e em OKLCH é a
 * luminosidade que carrega o contraste. Se isso estiver certo, nenhuma escolha
 * possível produz uma paleta ilegível — não há o que avisar.
 *
 * "Se estiver certo" é o que este arquivo verifica, varrendo o espaço inteiro
 * de escolhas. Um aviso na tela protege quem lê o aviso; uma varredura protege
 * todo mundo.
 */

const MODOS: Modo[] = ["escuro", "claro"];

/**
 * Lê a paleta do `tokens.css`. A fonte real, não uma cópia — o mesmo princípio
 * do `pnpm contrast`: uma cópia envelhece e passa a aprovar o que não existe.
 */
function tokensDoCss(modo: Modo): Record<string, string> {
  const bruto = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");
  let css = "";
  let i = 0;
  for (;;) {
    const abre = bruto.indexOf("/*", i);
    if (abre === -1) {
      css += bruto.slice(i);
      break;
    }
    css += bruto.slice(i, abre);
    const fecha = bruto.indexOf("*/", abre + 2);
    if (fecha === -1) break;
    i = fecha + 2;
  }

  const seletor = modo === "escuro" ? ":root" : '[data-theme="light"]';
  const inicio = css.indexOf(seletor + " {");
  const corpo = css.slice(inicio, css.indexOf("\n}", inicio));

  const mapa: Record<string, string> = {};
  for (const [, nome, valor] of corpo.matchAll(/(--vx-[a-z0-9-]+) *: *([^;]+);/g)) {
    mapa[nome!] = valor!.trim();
  }
  return mapa;
}

describe("a semente padrão reproduz a paleta de hoje", () => {
  it("todo token derivado existe", () => {
    for (const modo of MODOS) {
      const paleta = derivar(SEMENTE_PADRAO[modo]);
      for (const token of TOKENS_DE_TEMA) {
        expect(paleta[token], `${modo}/${token}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  /**
   * O teste forte: os VINTE tokens, nos dois modos, byte a byte.
   *
   * A versão fraca conferia quatro e passava. Rampa que não reproduz o ponto de
   * partida é rampa que mudou o produto sem ninguém ter decidido — e a
   * diferença entre "quatro conferem" e "os vinte conferem" foi o que fez a
   * deriva de matiz da paleta original virar parte do modelo em vez de ser
   * achatada em silêncio.
   */
  it("a semente padrão reproduz tokens.css nos 20 tokens", () => {
    for (const modo of MODOS) {
      const doCss = tokensDoCss(modo);
      const derivada = derivar(SEMENTE_PADRAO[modo]);

      for (const token of TOKENS_DE_TEMA) {
        expect(derivada[token], `${modo} ${token}`).toBe(doCss[token]);
      }
    }
  });

  it("passa nos mesmos pares que o tokens.css passa", () => {
    for (const modo of MODOS) {
      const v = verificar(derivar(SEMENTE_PADRAO[modo]));
      // Só o que NÃO foi dispensado pelo design conta. Ver `EXCECOES`.
      const f = falhasQueContam(v.falhas, modo);
      expect(f, `${modo}: ${JSON.stringify(f)}`).toEqual([]);
    }
  });
});

describe("nenhuma escolha do usuário produz paleta ilegível", () => {
  /**
   * A varredura. Todo matiz de neutro, todo matiz de acento, todo nível de
   * croma — nos dois modos.
   *
   * É o teste mais caro do projeto e o que justifica a arquitetura inteira do
   * picker. Se ele falhar em um único ponto, a promessa "não dá para escolher
   * errado" é falsa, e o picker precisa de aviso e de bloqueio.
   */
  it("varre matiz do neutro × matiz do acento × croma", () => {
    const falhas: string[] = [];

    for (const modo of MODOS) {
      for (let matiz = 0; matiz < 360; matiz += 15) {
        for (let hAcento = 0; hAcento < 360; hAcento += 15) {
          for (const croma of [0, 0.5, 1, 1.8, LIMITES_DA_SEMENTE.croma.max]) {
            // Acento no croma máximo que o sRGB permite naquele matiz: é o
            // caso extremo, e é o que um color picker entrega quando alguém
            // arrasta o cursor para o canto.
            const semente = { ...SEMENTE_PADRAO[modo], matiz, croma };
            const paleta = derivar(semente);
            // Substitui o matiz do acento diretamente: `derivar` lê matiz e
            // croma da cor, e queremos varrer o matiz sem depender de achar um
            // hex para cada um.
            const comMatiz = derivar({
              ...semente,
              acento: acentoNoMatiz(hAcento),
            });

            for (const [rotulo, p] of [
              ["neutro", paleta],
              ["acento", comMatiz],
            ] as const) {
              const v = verificar(p);
              const contam = falhasQueContam(v.falhas, modo);
              if (contam.length > 0) {
                falhas.push(
                  `${modo} ${rotulo} matiz=${matiz} hAcento=${hAcento} croma=${croma}: ` +
                    contam
                      .map((f) => `${f.par.fg}/${f.par.bg} ${f.razao.toFixed(2)}`)
                      .join(", "),
                );
              }
            }
          }
        }
      }
    }

    expect(falhas.slice(0, 8)).toEqual([]);
  });
});

/** Uma cor de acento saturada naquele matiz, para varrer sem tabela de hex. */
function acentoNoMatiz(h: number): string {
  return oklchParaHex({ l: 0.7, c: 0.2, h });
}

describe("o croma do acento tem teto, e o teto é o que segura a garantia", () => {
  it("acento saturadíssimo continua passando", () => {
    for (const modo of MODOS) {
      const v = verificar(
        derivar({ ...SEMENTE_PADRAO[modo], acento: "#ff00ff" }),
      );
      const f = falhasQueContam(v.falhas, modo);
      expect(f, `${modo}: ${JSON.stringify(f)}`).toEqual([]);
    }
  });

  it("o acento derivado respeita o teto de croma", () => {
    const paleta = derivar({ ...SEMENTE_PADRAO.escuro, acento: "#ff00ff" });
    // Acompanha `TETO_DE_CROMA.escuro`. O teto subiu de 0,11 para 0,12 com a
    // identidade nova: o acento do design tem croma 0,1154, e um teto abaixo
    // disso faria a semente de fábrica NÃO reproduzir a própria paleta.
    expect(hexParaOklch(paleta["--vx-accent"]).c).toBeLessThanOrEqual(0.12);
  });

  it("acento cinza não quebra — vira acento sem croma", () => {
    for (const modo of MODOS) {
      const v = verificar(derivar({ ...SEMENTE_PADRAO[modo], acento: "#808080" }));
      expect(falhasQueContam(v.falhas, modo)).toEqual([]);
    }
  });
});
