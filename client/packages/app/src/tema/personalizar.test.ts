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
