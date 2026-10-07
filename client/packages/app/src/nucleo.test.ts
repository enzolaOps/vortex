import { describe, expect, it } from "vitest";

import { contagem } from "nucleo/lib/plural";

describe("ligação com o nucleo", () => {
  it("resolve um subcaminho do nucleo a partir do app", () => {
    expect(contagem(120)).toBe("99+");
  });
});
