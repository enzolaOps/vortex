import { beforeEach, describe, expect, it } from "vitest";

import { traduzirResultadosCrus } from "../sdk/busca";
import {
  apontarBuscaPara,
  definirEscopo,
  lerBusca,
  limparBusca,
} from "./busca";

/**
 * Busca no servidor inteiro.
 *
 * Duas coisas quebram em silêncio aqui: a tradução da resposta CRUA da rota do
 * fork (o SDK não hidrata essa resposta, então nome de campo trocado vira
 * lista vazia, que parece "nada encontrado"), e a regra de não limpar a lista
 * ao abrir um resultado de outro canal do mesmo servidor.
 */

const S = "01SERVIDOR0000000000000000";
const OUTRO = "01OUTROSERV000000000000000";

beforeEach(() => {
  limparBusca();
});

describe("traduzirResultadosCrus", () => {
  const nome = (id: string) => (id === "c1" ? "produto" : "geral");

  it("traduz lista pura, com hora tirada do ULID e o canal de cada uma", () => {
    const r = traduzirResultadosCrus(
      [
        {
          _id: "01JQ0000000000000000000000",
          channel: "c1",
          author: "ana",
          content: "oi",
          attachments: [{ filename: "a.png" }],
        },
        { _id: "01JQ0000000000000000000001", channel: "c2", content: null },
      ],
      nome,
    );
    expect(r.map((x) => [x.channelId, x.nomeDoCanal, x.conteudo, x.anexo])).toEqual([
      ["c1", "produto", "oi", "a.png"],
      ["c2", "geral", "", undefined],
    ]);
    expect(r[0]?.autorId).toBe("ana");
    expect(r[0]?.quando).not.toBe("");
  });

  it("aceita a forma com usuários", () => {
    expect(
      traduzirResultadosCrus({ messages: [{ _id: "01JQ0000000000000000000000", channel: "c1" }] }, nome),
    ).toHaveLength(1);
  });

  it("descarta item sem canal em vez de desenhar um cartão que não leva a lugar nenhum", () => {
    expect(traduzirResultadosCrus([{ _id: "x" }], nome)).toEqual([]);
  });
});

describe("escopo de servidor", () => {
  it("trocar de canal no MESMO servidor mantém o escopo", () => {
    apontarBuscaPara("c1", S);
    definirEscopo("servidor");
    apontarBuscaPara("c2", S);
    expect(lerBusca().escopo).toBe("servidor");
    expect(lerBusca().channelId).toBe("c2");
  });

  it("trocar de servidor volta ao canal", () => {
    apontarBuscaPara("c1", S);
    definirEscopo("servidor");
    apontarBuscaPara("c9", OUTRO);
    expect(lerBusca().escopo).toBe("canal");
  });

  it("em escopo de canal, trocar de canal limpa", () => {
    apontarBuscaPara("c1", S);
    apontarBuscaPara("c2", S);
    expect(lerBusca().escopo).toBe("canal");
    expect(lerBusca().serverId).toBe(S);
  });

  it("fora de servidor não há escopo de servidor", () => {
    apontarBuscaPara("dm", undefined);
    definirEscopo("servidor");
    expect(lerBusca().escopo).toBe("canal");
  });
});
