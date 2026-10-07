import { describe, expect, it } from "vitest";

import { motivoDoErro } from "./erros";

/**
 * O erro próprio do convite pausado. Sem a tradução ele cairia no genérico por
 * status (403, "sem permissão"), que manda procurar culpa na conta de quem
 * tentou entrar — e o link está certo, só está suspenso.
 */
describe("InvitesPaused", () => {
  it("diz que os convites estão pausados, e não 'sem permissão'", () => {
    expect(motivoDoErro({ type: "InvitesPaused" })).toBe(
      "Os convites deste canal estão pausados.",
    );
  });
});
