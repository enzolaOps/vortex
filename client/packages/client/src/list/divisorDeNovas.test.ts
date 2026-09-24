import { describe, expect, it } from "vitest";

import { rotuloDoDivisorDeNovas } from "./divisorDeNovas";

describe("rotuloDoDivisorDeNovas", () => {
  it("no tópico são respostas", () => {
    expect(rotuloDoDivisorDeNovas(true)).toBe("novas respostas");
  });

  it("no canal continuam sendo mensagens", () => {
    expect(rotuloDoDivisorDeNovas(false)).toBe("novas mensagens");
  });
});
