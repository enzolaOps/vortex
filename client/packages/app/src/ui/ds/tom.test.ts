import { describe, expect, it } from "vitest";

import { iniciais, siglasDeSalas, tomDe } from "./tom";

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

describe("siglas de sala", () => {
  it("tira o prefixo comum e usa duas letras", () => {
    expect(siglasDeSalas(["voz-geral", "voz-jogos", "voz-silencio"])).toEqual(["GE", "JO", "SI"]);
  });
  it("salas com o mesmo início não ficam iguais", () => {
    const s = siglasDeSalas(["voz-geral", "voz-games", "voz-gamer"]);
    expect(new Set(s).size).toBe(3);
  });
  it("sala única usa as duas primeiras letras", () => {
    expect(siglasDeSalas(["Lounge"])).toEqual(["LO"]);
  });
});
