import { describe, expect, it } from "vitest";

import {
  aplicarMencoes,
  consultaDeMencao,
  esquecerMencoes,
  inserirMencao,
  lembrarMencao,
  aplicarMencoesDoCanal,
} from "./mencao";

describe("consultaDeMencao", () => {
  it("pega @query no fim", () => {
    expect(consultaDeMencao("oi @enz", 7)).toEqual({ inicio: 3, query: "enz" });
  });

  it("@ sozinho no começo", () => {
    expect(consultaDeMencao("@", 1)).toEqual({ inicio: 0, query: "" });
  });

  it("não abre no meio de uma palavra", () => {
    expect(consultaDeMencao("a@b", 3)).toBeUndefined();
  });

  it("cursor fora do @ some", () => {
    expect(consultaDeMencao("oi @enz agora", 13)).toBeUndefined();
  });
});

describe("inserirMencao", () => {
  it("troca a query pelo @nome", () => {
    expect(inserirMencao("oi @en", 3, 6, "Marina")).toEqual({
      texto: "oi @Marina ",
      cursor: 11,
    });
  });
});

describe("aplicarMencoes", () => {
  const escolhidas = [{ id: "01X", nome: "enzo" }];

  it("troca @nome por <@id>", () => {
    expect(aplicarMencoes("oi @enzo ", escolhidas)).toBe("oi <@01X> ");
  });

  it("não come prefixo de outro nome", () => {
    expect(aplicarMencoes("@enzoia", escolhidas)).toBe("@enzoia");
  });

  it("aceita pontuação colada", () => {
    expect(aplicarMencoes("@enzo.", escolhidas)).toBe("<@01X>.");
  });
});

describe("lembrar por canal", () => {
  it("aplica o que foi escolhido e esquece no limpar", () => {
    lembrarMencao("c1", "01X", "enzo");
    expect(aplicarMencoesDoCanal("c1", "@enzo oi")).toBe("<@01X> oi");
    esquecerMencoes("c1");
    expect(aplicarMencoesDoCanal("c1", "@enzo oi")).toBe("@enzo oi");
  });
});
