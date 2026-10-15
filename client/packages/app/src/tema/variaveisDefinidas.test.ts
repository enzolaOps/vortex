import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(import.meta.dirname, "..");

function arquivos(dir: string, ext: RegExp): string[] {
  const saida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) saida.push(...arquivos(caminho, ext));
    else if (ext.test(e.name)) saida.push(caminho);
  }
  return saida;
}

/** Nomes `--vx-*` que alguém declara: em CSS, ou escritos em TS/TSX por `setProperty` / `style`. */
function definidas(): Set<string> {
  const nomes = new Set<string>();
  for (const f of arquivos(SRC, /\.css$/)) {
    for (const m of readFileSync(f, "utf8").matchAll(/(--vx-[a-z0-9-]+)\s*:/g)) nomes.add(m[1]!);
  }
  for (const f of arquivos(SRC, /\.tsx?$/)) {
    if (/\.test\.tsx?$/.test(f)) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/setProperty\(\s*["'`](--vx-[a-z0-9-]+)/g)) nomes.add(m[1]!);
    for (const m of src.matchAll(/["'`](--vx-[a-z0-9-]+)["'`]\s*:/g)) nomes.add(m[1]!);
  }
  return nomes;
}

/** `var(--vx-x)` SEM fallback: indefinida, resolve para nada e a cor herdada vence em silêncio. */
function usosSemFallback(css: string): string[] {
  return [...css.matchAll(/var\(\s*(--vx-[a-z0-9-]+)\s*\)/g)].map((m) => m[1]!);
}

describe("variáveis --vx-* usadas em CSS", () => {
  it("toda var(--vx-…) sem fallback tem declaração", () => {
    const def = definidas();
    const orfas: string[] = [];
    for (const f of arquivos(SRC, /\.css$/)) {
      for (const nome of usosSemFallback(readFileSync(f, "utf8"))) {
        if (!def.has(nome)) orfas.push(`${f.slice(SRC.length + 1)}: ${nome}`);
      }
    }
    expect(orfas).toEqual([]);
  });

  it("o detector enxerga uso sem fallback e ignora o que tem fallback", () => {
    expect(usosSemFallback("a{color:var(--vx-x)}")).toEqual(["--vx-x"]);
    expect(usosSemFallback("a{color:var(--vx-x, red)}")).toEqual([]);
  });
});
