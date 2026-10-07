import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./Shell.module.css", import.meta.url), "utf8");
const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("grade do shell (lei nº 3)", () => {
  const declaracoes = [...semComentarios.matchAll(/grid-template-(?:columns|rows):([^;]+);/g)].map(
    (m) => m[1]!,
  );

  it("declara colunas e linhas", () => {
    expect(declaracoes.length).toBeGreaterThanOrEqual(2);
  });

  it("toda trilha flexível é minmax(0, 1fr), nunca 1fr sozinho", () => {
    for (const d of declaracoes) {
      const semMinmax = d.replace(/minmax\(0,\s*1fr\)/g, "");
      expect(semMinmax, `trilha "1fr" solta em: ${d.trim()}`).not.toMatch(/\d*\.?\d*fr/);
    }
  });
});
