import { describe, expect, it } from "vitest";

import { avaliarAlias, MAX_ALIAS, normalizarAlias } from "./aliasDeEmoji";

const LISTA = [
  { id: "a", nome: "festa", porNome: "marina" },
  { id: "b", nome: "chorando", porNome: undefined },
];

describe("normalizarAlias", () => {
  it("tira acento sem comer a letra", () => {
    expect(normalizarAlias("ação")).toBe("acao");
  });

  it("junta o que não é nome numa sublinha só, e apara as pontas", () => {
    expect(normalizarAlias("  Festa da Firma!! ")).toBe("festa_da_firma");
  });

  it("corta no teto do protocolo", () => {
    expect(normalizarAlias("a".repeat(50))).toHaveLength(MAX_ALIAS);
  });

  it("devolve vazio quando não sobra caractere nenhum", () => {
    expect(normalizarAlias("🎉 !!!")).toBe("");
  });
});

describe("avaliarAlias", () => {
  it("salva o nome normalizado", () => {
    expect(avaliarAlias("Festa Nova", "a", "festa", LISTA)).toEqual({
      tipo: "salvar",
      nome: "festa_nova",
    });
  });

  it("não escreve quando nada mudou", () => {
    expect(avaliarAlias("festa", "a", "festa", LISTA)).toEqual({ tipo: "nada" });
    /* E nem quando o texto normaliza para o mesmo — "Festa" já é "festa". */
    expect(avaliarAlias("  Festa  ", "a", "festa", LISTA)).toEqual({ tipo: "nada" });
  });

  it("não escreve string vazia", () => {
    expect(avaliarAlias("   ", "a", "festa", LISTA)).toEqual({ tipo: "nada" });
  });

  /* ⚠ Sem excluir o próprio emoji, sair do campo sem mexer acusaria colisão
     consigo mesmo — o defeito que o comentário da função registra. */
  it("não colide consigo mesmo", () => {
    expect(avaliarAlias("festa", "a", "festa_antiga", LISTA)).toEqual({
      tipo: "salvar",
      nome: "festa",
    });
  });

  it("colide com outro e diz de quem é o alias", () => {
    expect(avaliarAlias("festa", "b", "chorando", LISTA)).toEqual({
      tipo: "colisao",
      dono: "marina",
    });
  });

  it("colisão com emoji sem criador registrado ainda é colisão", () => {
    expect(avaliarAlias("chorando", "a", "festa", LISTA)).toEqual({
      tipo: "colisao",
      dono: undefined,
    });
  });
});
