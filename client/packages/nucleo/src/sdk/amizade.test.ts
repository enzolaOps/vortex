import { beforeEach, describe, expect, it, vi } from "vitest";

const { notificarAmizade } = vi.hoisted(() => ({ notificarAmizade: vi.fn() }));

vi.mock("../notificacao/notificador", async (original) => ({
  ...(await original<typeof import("../notificacao/notificador")>()),
  notificarAmizade,
}));

import { startAdapter } from "./adapter";
import { client } from "./client";

/**
 * O pedido de amizade chega pelo evento CRU, e o que estes testes guardam é a
 * tradução — é ela que quebra calada.
 *
 * O caso que importa é o terceiro: o protocolo manda `Friend` também quando
 * VOCÊ aceita, e sem o estado anterior o app avisaria "fulano aceitou" logo
 * depois do seu próprio clique.
 */

function relacao(userId: string, status: string, nome = "bea.t") {
  client.events.emit("event", {
    type: "UserRelationship",
    user: { _id: userId, username: nome, relationship: status },
    status,
  } as never);
}

beforeEach(() => {
  /* Idempotente: o adapter só liga os ouvintes uma vez. */
  startAdapter();
  notificarAmizade.mockClear();
});

describe("amizade pelo evento cru", () => {
  it("pedido recebido de quem a sessão nunca viu avisa, com o nome", () => {
    relacao("01JQAMIGO000000000000000A1", "Incoming");
    expect(notificarAmizade).toHaveBeenCalledTimes(1);
    expect(notificarAmizade.mock.calls[0]![0]).toEqual({
      userId: "01JQAMIGO000000000000000A1",
      nome: "bea.t",
      mudanca: "pedido",
    });
  });

  it("o meu pedido aceito avisa como aceite", () => {
    relacao("01JQAMIGO000000000000000A2", "Outgoing");
    expect(notificarAmizade).not.toHaveBeenCalled();
    relacao("01JQAMIGO000000000000000A2", "Friend");
    expect(notificarAmizade.mock.calls[0]![0]).toMatchObject({ mudanca: "aceite" });
  });

  it("eu aceitar o pedido DELA não avisa", () => {
    relacao("01JQAMIGO000000000000000A3", "Incoming");
    notificarAmizade.mockClear();
    relacao("01JQAMIGO000000000000000A3", "Friend");
    expect(notificarAmizade).not.toHaveBeenCalled();
  });
});
