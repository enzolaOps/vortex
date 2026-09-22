import { beforeEach, describe, expect, it } from "vitest";

import { lerRecentes, limparRecentes, visitar } from "./recentes";

describe("recentes da paleta", () => {
  beforeEach(() => {
    limparRecentes();
  });

  it("o mais novo vem primeiro", () => {
    visitar("canal", "a");
    visitar("canal", "b");
    expect(lerRecentes().map((v) => v.id)).toEqual(["b", "a"]);
  });

  /**
   * Visitar de novo PROMOVE, nunca duplica — senão a lista de oito viraria
   * oito cópias do canal de sempre.
   */
  it("revisitar promove em vez de repetir", () => {
    visitar("canal", "a");
    visitar("canal", "b");
    visitar("canal", "a");
    expect(lerRecentes().map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("guarda no máximo oito", () => {
    for (let i = 0; i < 12; i++) visitar("canal", `c${i}`);
    expect(lerRecentes()).toHaveLength(8);
    expect(lerRecentes()[0]?.id).toBe("c11");
  });

  /**
   * ⚠ **Ação não é lugar.** "Marcar canal como lido" não responde "onde eu
   * estava?", e uma lista de recentes cheia de comandos deixaria de responder
   * a pergunta que ela existe para responder.
   */
  it("ação não entra no histórico", () => {
    visitar("acao", "painelMembros");
    expect(lerRecentes()).toHaveLength(0);
  });

  it("persiste entre leituras do módulo", () => {
    visitar("pessoa", "u1");
    expect(localStorage.getItem("vortex:paleta:recentes")).toContain("u1");
  });
});
