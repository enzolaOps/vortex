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
};

/** Os papéis do DS: tudo que um tema tem que declarar, e nada além. */
const PAPEIS = ds.color.tokens.map((t) => t.name);

/** Opacidade de pico de cada campo de cor, lida do `usage` do próprio DS. */
const CAMPOS: CampoDeCor[] = ds.color.tokens
  .filter((t) => t.name.startsWith("backdrop-glow-"))
  .map((t) => {
    const m = /opacidade ([0-9.]+)/.exec(t.usage);
    if (!m) throw new Error(`${t.name}: usage sem "opacidade N"`);
    return { papel: t.name, opacidade: Number(m[1]) };
  });

/** Todo arquivo de tema: o gerado do DS mais cada um de `temas/`. */
function arquivosDeTema(): string[] {
  const arquivos = [join(DIR, "tokens.gerado.css")];
  try {
    for (const f of readdirSync(join(DIR, "temas"))) {
      if (f.endsWith(".css")) arquivos.push(join(DIR, "temas", f));
    }
  } catch {
    /* ainda não há temas nomeados além do Vidro */
  }
  return arquivos;
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

  it.each(temas)("%s declara todo papel do DS e nenhum a mais", (_nome, papeis) => {
    const declarados = Object.keys(papeis).sort();
    expect(declarados).toEqual([...PAPEIS].sort());
  });

  describe.each(temas)("contraste: %s", (_nome, papeis) => {
    // Papel faltando falha aqui, com nome, em vez de derrubar a coleta inteira.
    const faltam = PAPEIS.filter((p) => !(p in papeis));
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

  it("papel faltando é erro, não par ignorado", () => {
    const semTexto = Object.fromEntries(Object.entries(vidro).filter(([k]) => k !== "text-1"));
    expect(() => medir(resolverReferencias(semTexto), PARES, CAMPOS)).toThrow(/text-1/);
  });
});
