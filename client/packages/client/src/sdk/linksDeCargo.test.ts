import { describe, expect, it } from "vitest";

import { linksDoCargo } from "./linksDeCargo";

/**
 * Quais convites são link DESTE cargo.
 *
 * A lista vem crua porque o SDK descarta `roles` ao hidratar convite. Um
 * filtro frouxo aqui mostraria na aba de um cargo o convite comum do servidor
 * — e "Revogar" nele apagaria o convite que todo mundo usa.
 */
describe("linksDoCargo", () => {
  const crus = [
    { type: "Server", _id: "comum", channel: "c", creator: "u" },
    { type: "Server", _id: "mod", channel: "c", creator: "u", roles: ["mod"] },
    { type: "Server", _id: "dois", channel: "c", creator: "u", roles: ["dev", "mod"] },
    { type: "Group", _id: "grupo", channel: "g", creator: "u", roles: ["mod"] },
  ];

  it("só convites de servidor que carregam o cargo", () => {
    expect(linksDoCargo(crus, "mod").map((l) => l.codigo)).toEqual(["mod", "dois"]);
  });

  it("convite sem cargos não é link de cargo nenhum", () => {
    expect(linksDoCargo(crus, "comum")).toEqual([]);
  });

  it("resposta fora da forma vira lista vazia, não exceção", () => {
    expect(linksDoCargo({ erro: true }, "mod")).toEqual([]);
  });
});
