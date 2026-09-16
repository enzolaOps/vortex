import { describe, expect, it } from "vitest";

import { resolverEmComum } from "./social";

const CONHECE = {
  servidor: (id: string) => id.startsWith("S"),
  pessoa: (id: string) => id.startsWith("U"),
};

/**
 * O corpo cru de `GET /users/{id}/mutual` → só o que vira linha na tela.
 */
describe("em comum", () => {
  it("resolve contra o cache e descarta o que não conhece", () => {
    expect(
      resolverEmComum(
        { users: ["U1", "X9", "U2"], servers: ["S1", "Z0"], channels: ["C1"] },
        CONHECE,
      ),
    ).toEqual({ servidores: ["S1"], amigos: ["U1", "U2"] });
  });

  it("repetido no corpo não vira duas linhas", () => {
    expect(
      resolverEmComum({ users: ["U1", "U1"], servers: ["S1", "S1"] }, CONHECE),
    ).toEqual({ servidores: ["S1"], amigos: ["U1"] });
  });

  it("nada em comum é lista vazia, e não falha", () => {
    expect(resolverEmComum({ users: [], servers: [] }, CONHECE)).toEqual({
      servidores: [],
      amigos: [],
    });
  });

  /*
    Corpo com forma errada é "não deu para saber", não "nada em comum" — a
    tela diz coisas diferentes para os dois.
  */
  it.each([undefined, null, "erro", {}, { users: "U1", servers: [] }])(
    "%s não é resposta",
    (bruto) => {
      expect(resolverEmComum(bruto, CONHECE)).toBeUndefined();
    },
  );
});
