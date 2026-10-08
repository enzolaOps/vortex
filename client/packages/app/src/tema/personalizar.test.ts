import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lerTemas, resolverReferencias, type CampoDeCor } from "./contraste";
import {
  DESTAQUES,
  derivarPapeis,
  falhasDeContraste,
  hsl,
  paletaValidada,
  normalizarHex,
  hexParaHsl,
  SEMENTES,
  TEMAS,
  PERSONALIZACAO_PADRAO,
  type BaseDoTema,
  type Personalizacao,
} from "./personalizar";

const DIR = import.meta.dirname;
const ds = JSON.parse(readFileSync(join(DIR, "tokens.json"), "utf8")) as {
  color: { tokens: { name: string; usage: string }[] };
};
const CAMPOS: CampoDeCor[] = ds.color.tokens
  .filter((t) => t.name.startsWith("backdrop-glow-"))
  .map((t) => ({ papel: t.name, opacidade: Number(/opacidade ([0-9.]+)/.exec(t.usage)?.[1]) }));
const VIDRO = lerTemas(readFileSync(join(DIR, "tokens.gerado.css"), "utf8"))["vidro"] ?? {};
const BASE: BaseDoTema = { papeis: resolverReferencias(VIDRO), campos: CAMPOS };

const combinacao = (matiz: number, intensidade: number, destaque: Personalizacao["destaque"]): Personalizacao => ({
  ...PERSONALIZACAO_PADRAO,
  ativo: true,
  matiz,
  intensidade,
  destaque,
});

describe("hsl", () => {
  it("converte as cores conhecidas", () => {
    expect(hsl(0, 100, 50)).toBe("#ff0000");
    expect(hsl(120, 100, 50)).toBe("#00ff00");
    expect(hsl(0, 0, 100)).toBe("#ffffff");
    expect(hsl(360, 100, 50)).toBe(hsl(0, 100, 50));
  });
});

describe("paleta personalizada", () => {
  it("o tema de fábrica passa nos pares (a régua está certa)", () => {
    expect(falhasDeContraste(BASE, {})).toEqual([]);
  });

  it("toda combinação de matiz, intensidade e destaque passa no contraste (varredura)", () => {
    const reprovadas: string[] = [];
    for (let matiz = 0; matiz < 360; matiz += 15) {
      for (const intensidade of [0, 25, 50, 75, 100]) {
        for (const destaque of DESTAQUES) {
          const p = combinacao(matiz, intensidade, destaque);
          const validada = paletaValidada(BASE, p);
          if (validada === undefined || falhasDeContraste(BASE, validada.papeis).length > 0) {
            reprovadas.push(`${String(matiz)}/${String(intensidade)}/${destaque}`);
          }
        }
      }
    }
    expect(reprovadas).toEqual([]);
  });

  it("a régua pega um tema ruim (mutação): destaque escuro demais reprova", () => {
    const ruim = { ...derivarPapeis(combinacao(250, 55, "lavanda")), accent: "#1a1a2a", "accent-hover": "#1a1a2a" };
    expect(falhasDeContraste(BASE, ruim).length).toBeGreaterThan(0);
  });

  it("campos de cor claros demais derrubam o contraste do texto do vidro", () => {
    const clara = {
      ...derivarPapeis(combinacao(250, 55, "lavanda")),
      "backdrop-base": "#ffffff",
      "backdrop-glow-indigo": "#ffffff",
      "backdrop-glow-teal": "#ffffff",
      "backdrop-glow-magenta": "#ffffff",
      "surface-glass": "rgba(255,255,255,0.1)",
      "surface-glass-reading": "rgba(255,255,255,0.1)",
      "surface-overlay": "rgba(255,255,255,0.1)",
      "surface-solid": "#ffffff",
    };
    expect(falhasDeContraste(BASE, clara).length).toBeGreaterThan(0);
  });

  it("sobrescreve só papéis que o tema de fábrica declara", () => {
    const papeis = Object.keys(derivarPapeis(combinacao(10, 10, "rosa")));
    for (const p of papeis) expect(VIDRO, p).toHaveProperty(p);
  });

  it("matiz e destaque mudam o resultado", () => {
    const a = derivarPapeis(combinacao(100, 50, "menta"));
    const b = derivarPapeis(combinacao(200, 50, "menta"));
    const c = derivarPapeis(combinacao(100, 50, "rosa"));
    expect(a["backdrop-base"]).not.toBe(b["backdrop-base"]);
    expect(a["accent"]).not.toBe(c["accent"]);
  });
});

describe("temas prontos", () => {
  it.each(TEMAS.filter((t) => t !== "vidro"))("%s passa no contraste", (id) => {
    const p = { ...PERSONALIZACAO_PADRAO, ...SEMENTES[id], ativo: true, tema: id };
    const validada = paletaValidada(BASE, p);
    expect(validada).toBeDefined();
    expect(falhasDeContraste(BASE, validada?.papeis ?? {})).toEqual([]);
  });

  it("os temas são distintos entre si", () => {
    const fundos = new Set(
      TEMAS.filter((t) => t !== "vidro").map((id) =>
        derivarPapeis({ ...PERSONALIZACAO_PADRAO, ...SEMENTES[id], ativo: true })["backdrop-base"],
      ),
    );
    expect(fundos.size).toBe(TEMAS.length - 1);
  });
});

describe("cor de destaque livre", () => {
  const livre = (hex: string): Personalizacao => ({
    ...PERSONALIZACAO_PADRAO,
    ativo: true,
    personalizado: true,
    destaqueLivre: hex,
  });

  it("normaliza o código hexadecimal", () => {
    expect(normalizarHex("#ABC")).toBe("#aabbcc");
    expect(normalizarHex("35C2CC")).toBe("#35c2cc");
    expect(normalizarHex("#12")).toBeUndefined();
    expect(normalizarHex("azul")).toBeUndefined();
  });

  it("converte hex em HSL", () => {
    expect(hexParaHsl("#ff0000")).toMatchObject({ h: 0, s: 100, l: 50 });
    expect(hexParaHsl("#808080").s).toBe(0);
  });

  it.each([
    ["amarelo puro", "#ffff00"],
    ["azul escuro", "#00008b"],
    ["azul puro", "#0000ff"],
    ["cinza", "#808080"],
    ["preto", "#000000"],
    ["branco", "#ffffff"],
    ["vermelho escuro", "#400000"],
  ])("%s vira um destaque legível", (_nome, hex) => {
    for (const matiz of [0, 120, 250]) {
      const validada = paletaValidada(BASE, { ...livre(hex), matiz });
      expect(validada, hex).toBeDefined();
      expect(falhasDeContraste(BASE, validada?.papeis ?? {}), hex).toEqual([]);
    }
  });

  it("não mexe numa cor que já se lê, e conta o antes e o depois na que não se lê", () => {
    expect(paletaValidada(BASE, livre("#a99bff"))?.destaqueAjustado).toBeUndefined();
    const ajustada = paletaValidada(BASE, livre("#00008b"))?.destaqueAjustado;
    expect(ajustada?.de).toBe("#00008b");
    expect(ajustada?.para).not.toBe("#00008b");
    expect(hexParaHsl(ajustada?.para ?? "#000000").l).toBeGreaterThan(hexParaHsl("#00008b").l);
  });

  it("varredura de matizes e luminosidades extremas passa no contraste", () => {
    const reprovadas: string[] = [];
    for (let h = 0; h < 360; h += 30) {
      for (const l of [2, 15, 30, 50, 70, 90, 98]) {
        for (const s of [0, 50, 100]) {
          const hex = normalizarHex(hsl(h, s, l)) ?? "#000000";
          const validada = paletaValidada(BASE, livre(hex));
          if (validada === undefined || falhasDeContraste(BASE, validada.papeis).length > 0) reprovadas.push(hex);
        }
      }
    }
    expect(reprovadas).toEqual([]);
  });
});
