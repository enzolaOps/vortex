import { describe, expect, it } from "vitest";

import { isolar } from "./isolar";

describe("isolar", () => {
  it("colado ao fim de uma palavra, ganha espaço antes e depois", () => {
    expect(isolar("olha isso", 9, 9, "https://g/1")).toBe(" https://g/1 ");
  });

  it("campo vazio não começa com espaço", () => {
    expect(isolar("", 0, 0, "https://g/1")).toBe("https://g/1 ");
  });

  it("já separado por espaço dos dois lados, não duplica", () => {
    expect(isolar("a  b", 2, 2, "https://g/1")).toBe("https://g/1");
  });

  it("no meio de uma palavra, separa as duas metades", () => {
    expect(isolar("abcd", 2, 2, "x")).toBe(" x ");
  });

  it("substituindo uma seleção, olha as bordas dela", () => {
    expect(isolar("a XX b", 2, 4, "x")).toBe("x");
  });
});
