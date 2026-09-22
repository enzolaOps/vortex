import { describe, expect, it } from "vitest";

import { estadoDoEspectador, ordemDosEspectadores } from "./espectador";

describe("as quatro frases de D-TELA-16", () => {
  it("assistindo · 1080p", () => {
    expect(
      estadoDoEspectador([{ dono: "d", altura: 1080, rede: false, cheia: false }], "d"),
    ).toEqual({ assistindo: true, texto: "assistindo · 1080p", rede: false });
  });

  it("assistindo · 720p (rede), em warning", () => {
    expect(
      estadoDoEspectador([{ dono: "d", altura: 720, rede: true, cheia: false }], "d"),
    ).toEqual({ assistindo: true, texto: "assistindo · 720p (rede)", rede: true });
  });

  it("tela cheia ganha da resolução", () => {
    expect(
      estadoDoEspectador([{ dono: "d", altura: 720, rede: true, cheia: true }], "d").texto,
    ).toBe("assistindo em tela cheia");
  });

  it("assistindo OUTRA tela é não estar assistindo esta", () => {
    expect(
      estadoDoEspectador([{ dono: "x", altura: 1080, rede: false, cheia: false }], "d"),
    ).toEqual({ assistindo: false, texto: "não está assistindo", rede: false });
  });

  it("sem altura medida não escreve número", () => {
    expect(estadoDoEspectador([{ dono: "d", rede: false, cheia: false }], "d").texto).toBe(
      "assistindo",
    );
  });
});

describe("ordem da coluna", () => {
  it("quem assiste primeiro, o dono de fora, e o total é a sala sem ele", () => {
    expect(ordemDosEspectadores(["d", "a", "b", "c"], ["c", "a"], "d")).toEqual({
      lista: ["a", "c", "b"],
      assistindo: 2,
      total: 3,
    });
  });

  it("espectador que já saiu da sala não conta", () => {
    expect(ordemDosEspectadores(["d", "a"], ["a", "fantasma"], "d").assistindo).toBe(1);
  });
});
