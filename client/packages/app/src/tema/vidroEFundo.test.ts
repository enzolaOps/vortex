import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lerTemas, parseCor, resolverReferencias, type CampoDeCor } from "./contraste";
import {
  DESTAQUES,
  falhasDeContraste,
  hexParaHsl,
  paletaValidada,
  PERSONALIZACAO_PADRAO,
  SEMENTES,
  TEMAS,
  type BaseDoTema,
  type Personalizacao,
} from "./personalizar";
import { ajustesDeVidro, camposComBrilho } from "./vidroEFundo";

const DIR = import.meta.dirname;
const ds = JSON.parse(readFileSync(join(DIR, "tokens.json"), "utf8")) as {
  color: { tokens: { name: string; usage: string }[] };
};
const CAMPOS: CampoDeCor[] = ds.color.tokens
  .filter((t) => t.name.startsWith("backdrop-glow-"))
  .map((t) => ({ papel: t.name, opacidade: Number(/opacidade ([0-9.]+)/.exec(t.usage)?.[1]) }));
const VIDRO = lerTemas(readFileSync(join(DIR, "tokens.gerado.css"), "utf8"))["vidro"] ?? {};
const BASE: BaseDoTema = { papeis: resolverReferencias(VIDRO), campos: CAMPOS };

const PONTOS_DE_VIDRO = [0, 5, 20, 35, 50, 65, 80, 95, 100];
const PONTOS_DE_BRILHO = [0, 10, 40, 70, 100];

/** Os temas a medir: o de fábrica, os prontos e uma volta de matiz com cada destaque. */
function paletas(): { nome: string; papeis: Readonly<Record<string, string>> }[] {
  const saida: { nome: string; papeis: Readonly<Record<string, string>> }[] = [{ nome: "fábrica", papeis: {} }];
  const combinacoes: Personalizacao[] = TEMAS.filter((t) => t !== "vidro").map((t) => ({
    ...PERSONALIZACAO_PADRAO,
    ...SEMENTES[t],
    tema: t,
    ativo: true,
  }));
  for (let matiz = 0; matiz < 360; matiz += 60) {
    for (const destaque of DESTAQUES) {
      combinacoes.push({ ...PERSONALIZACAO_PADRAO, ativo: true, matiz, intensidade: 100, destaque });
    }
  }
  for (const p of combinacoes) {
    const v = paletaValidada(BASE, p);
    if (v) saida.push({ nome: `${p.tema} ${String(p.matiz)} ${p.destaque}`, papeis: v.papeis });
  }
  return saida;
}

describe("vidro e brilho de fundo", () => {
  it("no desenho de fábrica não escreve nada", () => {
    expect(ajustesDeVidro(BASE.papeis, { vidro: 100, brilho: 100 })).toEqual({});
  });

  it("o extremo sólido liga o desfoque a 'none' e deixa as três superfícies opacas", () => {
    const a = ajustesDeVidro(BASE.papeis, { vidro: 0, brilho: 100 });
    expect(a["backdrop-glass"]).toBe("none");
    expect(a["blur-glass"]).toBe("0px");
    for (const nome of ["surface-glass", "surface-glass-reading", "surface-overlay"]) {
      expect(parseCor(a[nome] ?? "").a).toBe(1);
    }
  });

  it("no meio do controle o desfoque continua, mais fraco, e a opacidade sobe", () => {
    const a = ajustesDeVidro(BASE.papeis, { vidro: 50, brilho: 100 });
    expect(a["backdrop-glass"]).toBeUndefined();
    expect(a["blur-glass"]).toBe("14px");
    expect(parseCor(a["surface-glass"] ?? "").a).toBeGreaterThan(parseCor(BASE.papeis["surface-glass"] ?? "").a);
  });

  it("brilho desligado esconde as manchas; no meio só reduz a intensidade", () => {
    expect(ajustesDeVidro(BASE.papeis, { vidro: 100, brilho: 0 })).toMatchObject({
      "glow-exibir": "none",
      "glow-escala": "0",
    });
    const meio = ajustesDeVidro(BASE.papeis, { vidro: 100, brilho: 40 });
    expect(meio["glow-escala"]).toBe("0.4");
    expect(meio["glow-exibir"]).toBeUndefined();
  });

  it("opacidade nunca cai abaixo da de fábrica em nenhum ponto", () => {
    for (const v of PONTOS_DE_VIDRO) {
      const a = ajustesDeVidro(BASE.papeis, { vidro: v, brilho: 100 });
      for (const nome of ["surface-glass", "surface-glass-reading", "surface-overlay"]) {
        const fabrica = parseCor(BASE.papeis[nome] ?? "").a;
        const agora = parseCor(a[nome] ?? BASE.papeis[nome] ?? "").a;
        expect(agora).toBeGreaterThanOrEqual(fabrica);
      }
    }
  });

  it("o contraste do texto sobre o vidro passa em todos os pontos dos dois controles (varredura)", () => {
    const reprovadas: string[] = [];
    for (const { nome, papeis } of paletas()) {
      for (const vidro of PONTOS_DE_VIDRO) {
        for (const brilho of PONTOS_DE_BRILHO) {
          const resolvidos = { ...BASE.papeis, ...papeis };
          const final = { ...papeis, ...ajustesDeVidro(resolvidos, { vidro, brilho }) };
          const base: BaseDoTema = { papeis: BASE.papeis, campos: camposComBrilho(CAMPOS, brilho) };
          const falhas = falhasDeContraste(base, final);
          if (falhas.length > 0) reprovadas.push(`${nome} vidro=${String(vidro)} brilho=${String(brilho)}: ${falhas.join(", ")}`);
        }
      }
    }
    expect(reprovadas).toEqual([]);
  });

  it("controle: a régua enxerga uma superfície que ficou transparente demais", () => {
    const ruim = { ...BASE.papeis, "surface-glass": "rgba(255,255,255,0.1)", "surface-glass-reading": "rgba(255,255,255,0.1)" };
    expect(falhasDeContraste({ papeis: ruim, campos: CAMPOS }, {}).length).toBeGreaterThan(0);
  });
});

describe("Aurora não se confunde com Oceano", () => {
  const distancia = (a: number, b: number) => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  };

  it("o fundo e o destaque ficam a pelo menos 60° um do outro", () => {
    const aurora = SEMENTES.aurora;
    const oceano = SEMENTES.oceano;
    expect(distancia(aurora.matiz, oceano.matiz)).toBeGreaterThanOrEqual(60);
    const cor = (id: typeof aurora.destaque) => hexParaHsl(paletaValidada(BASE, { ...PERSONALIZACAO_PADRAO, ativo: true, ...SEMENTES.aurora, destaque: id })?.papeis["accent"] ?? "#000000").h;
    expect(distancia(cor(aurora.destaque), cor(oceano.destaque))).toBeGreaterThanOrEqual(60);
  });

  it("nenhum par de temas coloridos tem o mesmo matiz de fundo", () => {
    const coloridos = TEMAS.filter((t) => SEMENTES[t].intensidade > 20);
    for (const a of coloridos) {
      for (const b of coloridos) {
        if (a >= b) continue;
        expect(distancia(SEMENTES[a].matiz, SEMENTES[b].matiz), `${a} x ${b}`).toBeGreaterThanOrEqual(30);
      }
    }
  });
});
