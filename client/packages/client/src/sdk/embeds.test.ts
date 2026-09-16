import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { messages, removerEmbeds } from "./adapter";
import { client } from "./client";

/**
 * Remover a prévia de link.
 *
 * O que se guarda é o que SOBRA: a prévia gerada pelo servidor sai, e o cartão
 * que o autor mandou de propósito (`Text`) fica. Um filtro invertido apagaria
 * exatamente o embed que alguém escreveu à mão e deixaria o que ninguém pediu.
 */

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  await seed(20);
});

describe("remover embeds", () => {
  it("tira a prévia gerada e mantém o cartão do autor", () => {
    const id = "01JQ00000000000000000E0001";
    client.messages.getOrCreate(
      id,
      {
        _id: id,
        channel: CHANNEL_ID,
        author: "01JQ0000000000000001000005",
        content: "olha https://exemplo.com",
        embeds: [
          { type: "Website", url: "https://exemplo.com", title: "Exemplo", description: "site" },
          { type: "Text", title: "Nota", description: "escrita pelo autor" },
        ],
      } as never,
      true,
    );
    messages.subscriber(id)(() => {});
    expect(messages.peek(id)?.embeds).toHaveLength(2);

    removerEmbeds(id);

    const depois = messages.peek(id)?.embeds ?? [];
    expect(depois).toHaveLength(1);
    expect(depois[0]?.titulo).toBe("Nota");
  });
});
