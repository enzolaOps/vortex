import { describe, expect, it } from "vitest";

import { iniciais, tomDe } from "./tom";

describe("tom e iniciais do avatar", () => {
  it("tom explícito vence; sem ele o ID decide, sempre o mesmo", () => {
    expect(tomDe("u1", "Ana", 5)).toBe(5);
    expect(tomDe("u1", "Ana")).toBe(tomDe("u1", "Outro nome"));
    expect(tomDe(undefined, "Ana")).toBe(tomDe(undefined, "Ana"));
  });

  it("tom inválido cai no hash, sempre entre 1 e 8", () => {
    for (const t of [0, 9, 2.5, -1]) {
      const r = tomDe("x", "X", t);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(8);
    }
  });

  it("IDs com prefixo comum ainda espalham pelos oito tons", () => {
    const vistos = new Set<number>();
    for (let i = 0; i < 200; i++) vistos.add(tomDe(`01HZZZZZZZZZZZZZZZZZZZ${i}`, "x"));
    expect(vistos.size).toBe(8);
  });

  it("iniciais: primeira e última palavra, maiúsculas", () => {
    expect(iniciais("Caio Melo")).toBe("CM");
    expect(iniciais("ana maria de souza")).toBe("AS");
    expect(iniciais("Davi")).toBe("D");
    expect(iniciais("  ")).toBe("");
  });
});

describe("nome vazio ou ausente", () => {
  it("não lança e devolve tom neutro estável e sem iniciais", () => {
    const vazio = undefined as unknown as string;
    expect(tomDe(undefined, vazio)).toBe(1);
    expect(tomDe(undefined, "")).toBe(1);
    expect(iniciais(vazio)).toBe("");
    expect(iniciais("   ")).toBe("");
  });
});
