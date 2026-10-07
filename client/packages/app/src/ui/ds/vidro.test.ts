import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DONO, linhasComBackdrop, violacoes } from "../../../scripts/vidro.mjs";

describe("guarda do Vidro", () => {
  it("a árvore real só tem backdrop-filter em PainelVidro", () => {
    expect(violacoes()).toEqual([]);
  });

  it("acha a propriedade, com prefixo e em minificado", () => {
    expect(linhasComBackdrop(".a{\n  backdrop-filter: blur(1px);\n}")).toEqual([2]);
    expect(linhasComBackdrop(".a{-webkit-backdrop-filter:blur(1px)}")).toEqual([1]);
  });

  it("comentário que cita a regra não é declaração", () => {
    expect(linhasComBackdrop("/* o único com `backdrop-filter` */\n.a{color:red}")).toEqual([]);
  });

  it("controle: um CSS fora do dono reprova e o dono é isento", () => {
    const base = mkdtempSync(join(tmpdir(), "vidro-"));
    try {
      mkdirSync(join(base, "src/ui/ds"), { recursive: true });
      mkdirSync(join(base, "src/outro"), { recursive: true });
      writeFileSync(join(base, DONO), ".v{backdrop-filter:blur(2px)}");
      expect(violacoes(base)).toEqual([]);
      writeFileSync(join(base, "src/outro/x.module.css"), ".x{\n backdrop-filter: blur(2px);\n}");
      expect(violacoes(base)).toEqual(["src/outro/x.module.css:2"]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
