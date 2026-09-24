import { describe, expect, it } from "vitest";

import { rotuloDePrevia } from "./previaDeCategoria";

describe("rotuloDePrevia", () => {
  it("vazio vira NOVA CATEGORIA", () => {
    expect(rotuloDePrevia("")).toBe("NOVA CATEGORIA");
  });

  it("só espaço conta como vazio", () => {
    expect(rotuloDePrevia("   ")).toBe("NOVA CATEGORIA");
  });

  it("caixa alta independente de como se digitou", () => {
    expect(rotuloDePrevia("Pesquisa")).toBe("PESQUISA");
    expect(rotuloDePrevia("  área de café ")).toBe("ÁREA DE CAFÉ");
  });
});
