import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pasta = dirname(fileURLToPath(import.meta.url));
const modulos = readdirSync(pasta).filter((f) => f.endsWith(".module.css"));

describe("movimento dos componentes do DS", () => {
  it.each(modulos)("%s: quem anima respeita prefers-reduced-motion", (arquivo) => {
    const css = readFileSync(join(pasta, arquivo), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    if (!/(^|[\s;{])(animation|transition)\s*:/.test(css)) return;
    expect(css).toContain("prefers-reduced-motion");
  });

  it.each(modulos)("%s: duração nunca passa de 240ms e só anima transform, opacity ou cor", (arquivo) => {
    const css = readFileSync(join(pasta, arquivo), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, valor] of css.matchAll(/transition\s*:([^;]+);/g)) {
      for (const parte of (valor ?? "").split(",")) {
        const prop = parte.trim().split(/\s+/)[0];
        expect(["none", "transform", "opacity", "visibility", "color", "background", "background-color"]).toContain(prop);
        for (const [, n, un] of parte.matchAll(/(\d*\.?\d+)(ms|s)\b/g)) {
          const ms = Number(n) * (un === "s" ? 1000 : 1);
          if (prop !== "visibility") expect(ms).toBeLessThanOrEqual(240);
        }
      }
    }
  });
});
