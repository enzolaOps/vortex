import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lerTemas, medir, resolverReferencias, type CampoDeCor } from "./contraste";
import { PARES } from "./pares";

const DIR = import.meta.dirname;

interface TokenDoDs {
  name: string;
  value: string;
  usage: string;
}
const ds = JSON.parse(readFileSync(join(DIR, "tokens.json"), "utf8")) as {
  color: { tokens: TokenDoDs[] };
  shadow: { tokens: TokenDoDs[] };
};

/**
 * Os papéis do DS: tudo que um tema tem que declarar, e nada além. As sombras
 * contam: carregam cor (anel de seleção, reflexo do vidro, elevação) e por isso
 * são declaradas por tema.
 */
const PAPEIS_DE_COR = ds.color.tokens.map((t) => t.name);
const PAPEIS = [...PAPEIS_DE_COR, ...ds.shadow.tokens.map((t) => t.name)];

/** Opacidade de pico de cada campo de cor, lida do `usage` do próprio DS. */
const CAMPOS: CampoDeCor[] = ds.color.tokens
  .filter((t) => t.name.startsWith("backdrop-glow-"))
  .map((t) => {
    const m = /opacidade ([0-9.]+)/.exec(t.usage);
    if (!m) throw new Error(`${t.name}: usage sem "opacidade N"`);
    return { papel: t.name, opacidade: Number(m[1]) };
  });

/**
 * Todo arquivo de tema: o gerado (Vidro de tokens.json mais cada `temas/<id>.json`)
 * e qualquer `temas/*.css` escrito à mão, se um dia existir.
 */
function arquivosDeTema(): string[] {
  const arquivos = [join(DIR, "tokens.gerado.css")];
  for (const f of readdirSync(join(DIR, "temas"))) {
    if (f.endsWith(".css")) arquivos.push(join(DIR, "temas", f));
  }
  return arquivos;
}

/** Os ids declarados em `temas/*.json`: cada um tem de aparecer no CSS gerado. */
const IDS_DE_TEMAS_JSON = readdirSync(join(DIR, "temas"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -".json".length));

/** `color-scheme` de cada bloco `[data-tema]` do CSS gerado. */
function esquemas(css: string): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const bloco of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const esquema = /color-scheme\s*:\s*([a-z ]+);/.exec(bloco[2] ?? "")?.[1]?.trim();
    for (const m of (bloco[1] ?? "").matchAll(/\[data-tema="([^"]+)"\]/g)) {
      if (esquema !== undefined) saida[m[1] ?? ""] = esquema;
    }
  }
  return saida;
}

const temas: [string, Record<string, string>][] = [];
for (const arquivo of arquivosDeTema()) {
  for (const [id, papeis] of Object.entries(lerTemas(readFileSync(arquivo, "utf8")))) {
    temas.push([`${id} (${arquivo.slice(DIR.length + 1)})`, papeis]);
  }
}

describe("temas", () => {
  it("existe ao menos o tema Vidro", () => {
    expect(temas.map(([n]) => n.split(" ")[0])).toContain("vidro");
  });

  it("todo tema de temas/*.json foi gerado (rode `pnpm tokens` se falhar)", () => {
    expect(IDS_DE_TEMAS_JSON.length).toBeGreaterThan(0);
    const ids = temas.map(([n]) => n.split(" ")[0]);
    for (const id of IDS_DE_TEMAS_JSON) expect(ids).toContain(id);
  });

  it("cada tema declara o próprio color-scheme (claro em tema claro, escuro em tema escuro)", () => {
    const e = esquemas(readFileSync(join(DIR, "tokens.gerado.css"), "utf8"));
    expect(e["vidro"]).toBe("dark");
    expect(e["claro"]).toBe("light");
    for (const [n] of temas) expect(e[n.split(" ")[0] ?? ""], n).toMatch(/^(dark|light)$/);
  });

  it.each(temas)("%s declara todo papel do DS e nenhum a mais", (_nome, papeis) => {
    const declarados = Object.keys(papeis).sort();
    expect(declarados).toEqual([...PAPEIS].sort());
  });

  describe.each(temas)("contraste: %s", (_nome, papeis) => {
    // Papel faltando falha aqui, com nome, em vez de derrubar a coleta inteira.
    const faltam = PAPEIS_DE_COR.filter((p) => !(p in papeis));
    if (faltam.length > 0) {
      it("tem todos os papéis para medir", () => expect(faltam).toEqual([]));
      return;
    }
    const resultados = medir(resolverReferencias(papeis), PARES, CAMPOS);

    it.each(resultados.map((r) => [r.par, r] as const))("%s", (_par, r) => {
      expect(
        r.piorCaso,
        `${r.par}: pior caso ${r.piorCaso.toFixed(2)}:1, mínimo ${r.minimo}:1`,
      ).toBeGreaterThanOrEqual(r.minimo);
    });
  });
});

describe("o método reproduz a tabela do design system", () => {
  // Valores da coluna "Pior caso" do README do DS (tema Vidro).
  const vidro = temas.find(([n]) => n.startsWith("vidro"))?.[1];
  const resultados = () =>
    new Map(medir(resolverReferencias(vidro ?? {}), PARES, CAMPOS).map((r) => [r.par, r.piorCaso]));

  it.each([
    ["text-1 (texto)", 14.54], // o menor entre as seis superfícies é "overlay"
    ["text-4 (texto)", 4.84],
    ["border-strong (borda de controle)", 3.34],
    ["text-on-accent / accent-press", 6.1],
    ["branco / avatar-3".replace("branco", "#ffffff"), 6.17],
  ])("%s ≈ %f", (par, esperado) => {
    expect(resultados().get(par)).toBeCloseTo(esperado, 1);
  });
});

describe("o teste detecta tema ruim (mutação permanente)", () => {
  const vidro = temas.find(([n]) => n.startsWith("vidro"))?.[1] ?? {};

  it("text-4 escurecido reprova o texto de placeholder", () => {
    const ruim = resolverReferencias({ ...vidro, "text-4": "#4a5068" });
    const falhas = medir(ruim, PARES, CAMPOS).filter((r) => !r.ok);
    expect(falhas.map((f) => f.par)).toContain("text-4 (texto)");
  });

  it("um glow mais claro por baixo do vidro derruba o pior caso", () => {
    const base = medir(resolverReferencias(vidro), PARES, CAMPOS);
    const claro = resolverReferencias({ ...vidro, "backdrop-glow-teal": "#ffffff" });
    const depois = medir(claro, PARES, CAMPOS);
    const antes = base.find((r) => r.par === "text-3 (texto)")?.piorCaso ?? 0;
    const agora = depois.find((r) => r.par === "text-3 (texto)")?.piorCaso ?? 0;
    expect(agora).toBeLessThan(antes);
  });

  it("no tema claro, um texto clareado reprova (a régua vale nos dois sentidos de luz)", () => {
    const claro = temas.find(([n]) => n.startsWith("claro"))?.[1] ?? {};
    const ruim = resolverReferencias({ ...claro, "text-4": "#8a8fa3" });
    const falhas = medir(ruim, PARES, CAMPOS).filter((r) => !r.ok);
    expect(falhas.map((f) => f.par)).toContain("text-4 (texto)");
  });

  it("papel faltando é erro, não par ignorado", () => {
    const semTexto = Object.fromEntries(Object.entries(vidro).filter(([k]) => k !== "text-1"));
    expect(() => medir(resolverReferencias(semTexto), PARES, CAMPOS)).toThrow(/text-1/);
  });
});
