import { describe, expect, it } from "vitest";

import { motivoDoErro } from "./erros";

/** O `stoat-api` lança o corpo em texto. Sem a frase, o 400 vira "recusou o pedido". */
describe("CompromisedPassword", () => {
  it("manda escolher outra senha", () => {
    expect(
      motivoDoErro(
        '{"type":"CompromisedPassword","location":"crates/core/database/src/util/password.rs:72:20"}',
      ),
    ).toBe("Essa senha já apareceu em um vazamento. Escolha outra.");
  });
});
