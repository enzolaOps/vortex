import { describe, expect, it } from "vitest";

import { casa } from "../textos";
import { nomeDaConversa } from "./useNomeDaConversa";

describe("nomeDaConversa", () => {
  it("DM sem a pessoa carregada nunca fica vazia nem undefined", () => {
    for (const canal of [{ tipo: "dm" }, { tipo: "dm", name: undefined }, { tipo: "dm", name: "" }]) {
      expect(nomeDaConversa(canal, undefined)).toBe(casa.conversa.semNome);
    }
    expect(nomeDaConversa({ tipo: "dm" }, { displayName: "", username: "" })).toBe(casa.conversa.semNome);
  });

  it("DM: nome de exibição, depois username", () => {
    expect(nomeDaConversa({ tipo: "dm" }, { displayName: "Ana", username: "ana" })).toBe("Ana");
    expect(nomeDaConversa({ tipo: "dm" }, { displayName: " ", username: "ana" })).toBe("ana");
  });

  it("grupo e notas", () => {
    expect(nomeDaConversa({ tipo: "grupo", name: "Turma" }, undefined)).toBe("Turma");
    expect(nomeDaConversa({ tipo: "grupo", name: "" }, undefined)).toBe(casa.conversa.grupoSemNome);
    expect(nomeDaConversa({ tipo: "notas" }, undefined)).toBe(casa.conversa.notasTitulo);
  });
});
