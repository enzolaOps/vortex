import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  anotarCanais,
  aplicarEventoCru,
  assinarMetaDeCanal,
  corDeTag,
  lerAbertura,
  lerContagem,
  lerForum,
  lerTopico,
  limparMetaDeCanal,
  reacaoPrincipal,
  semearListagem,
  traduzirAbertura,
} from "./vortexCanal";

/**
 * O registro dos campos que só o Vortex conhece.
 *
 * O que estes testes guardam é a TRADUÇÃO e os eventos — é o que quebra em
 * silêncio: um campo lido com o nome errado não dá erro, dá um fórum que vira
 * canal de texto e um tópico que nunca aparece no painel.
 */

const SRV = "01SRV0000000000000000000000";
const FORUM = "01FORUM00000000000000000000";
const TOPICO = "01TOPICO0000000000000000000";

function topicoCru(extra: object = {}) {
  return {
    _id: TOPICO,
    channel_type: "TextChannel",
    server: SRV,
    name: "bug: rail duplica pasta",
    thread: { parent: FORUM, owner: "01EU", followers: ["01EU"], ...extra },
  };
}

beforeEach(() => limparMetaDeCanal());

describe("tradução", () => {
  it("fórum e galeria são TextChannel com `forum`", () => {
    anotarCanais([
      {
        _id: FORUM,
        server: SRV,
        name: "ideias",
        forum: { tags: [{ id: "bug", name: "bug", colour: "#E8596B" }] },
      },
      { _id: "01GALERIA", server: SRV, name: "galeria", forum: { media: true } },
    ]);
    expect(lerForum(FORUM)).toEqual({
      midia: false,
      tags: [{ id: "bug", nome: "bug", cor: "#e8596b" }],
    });
    expect(lerForum("01GALERIA")?.midia).toBe(true);
  });

  it("cor de tag só passa `#rrggbb` — o resto vai para style", () => {
    expect(corDeTag("#35c2cc")).toBe("#35c2cc");
    expect(corDeTag("var(--vx-accent)")).toBeUndefined();
    expect(corDeTag("url(http://x)")).toBeUndefined();
    expect(corDeTag("#fff")).toBeUndefined();
  });

  it("tópico sem pai não é tópico", () => {
    anotarCanais([{ ...topicoCru(), thread: { owner: "01EU" } }]);
    expect(lerTopico(TOPICO)).toBeUndefined();
  });

  it("guarda nome e última mensagem do objeto do canal", () => {
    anotarCanais([{ ...topicoCru(), last_message_id: "01MSG" }]);
    expect(lerTopico(TOPICO)).toMatchObject({
      nome: "bug: rail duplica pasta",
      paiId: FORUM,
      serverId: SRV,
      ultimaMensagemId: "01MSG",
      arquivado: false,
      seguidores: ["01EU"],
    });
  });

  it("fixado vem de `pinned`, e tópico antigo sem o campo não é fixado", () => {
    anotarCanais([topicoCru({ pinned: true })]);
    expect(lerTopico(TOPICO)?.fixado).toBe(true);
    anotarCanais([topicoCru()]);
    expect(lerTopico(TOPICO)?.fixado).toBe(false);
  });

  it("reação principal: mais PESSOAS, empate fica com a primeira, vazia não conta", () => {
    expect(
      reacaoPrincipal({ "👀": ["a", "b"], "🎯": ["a", "b", "c", "c"], "🧠": ["x", "y", "z"] }),
    ).toEqual({ emoji: "🎯", total: 3 });
    expect(reacaoPrincipal({ "🧠": ["a"], "🎯": ["b"] })).toEqual({ emoji: "🧠", total: 1 });
    expect(reacaoPrincipal({ "🧠": [] })).toBeUndefined();
    expect(reacaoPrincipal(undefined)).toBeUndefined();
    expect(reacaoPrincipal(["🎯"])).toBeUndefined();
    expect(
      traduzirAbertura({ _id: "01M", author: "01A", reactions: { "⚡": ["a", "b"] } })?.reacao,
    ).toEqual({ emoji: "⚡", total: 2 });
  });

  it("abertura: primeira imagem ou vídeo, gif pelo content_type, spoiler pelo nome", () => {
    const a = traduzirAbertura({
      _id: "01M",
      author: "01A",
      content: "olha",
      attachments: [
        { _id: "f0", tag: "attachments", filename: "a.txt", metadata: { type: "File" } },
        {
          _id: "f1",
          tag: "attachments",
          filename: "SPOILER_x.gif",
          content_type: "image/gif",
          size: 2_400,
          metadata: { type: "Image", width: 400, height: 300 },
        },
      ],
    });
    expect(a?.midia).toEqual({
      id: "f1",
      tag: "attachments",
      nome: "SPOILER_x.gif",
      tipo: "gif",
      largura: 400,
      altura: 300,
      spoiler: true,
      tamanho: 2_400,
    });
  });
});

describe("eventos", () => {
  it("`Ready` e `Bulk` anotam, e o ouvinte recebe só os IDs que mudaram", () => {
    const ouvinte = vi.fn();
    const soltar = assinarMetaDeCanal(ouvinte);
    aplicarEventoCru({
      type: "Bulk",
      v: [{ type: "Ready", channels: [topicoCru(), { _id: "01TXT", server: SRV }] }],
    });
    expect(ouvinte).toHaveBeenCalledWith([TOPICO]);
    soltar();
  });

  it("`ChannelUpdate` só com `name` renomeia o tópico sem perder o resto", () => {
    anotarCanais([topicoCru({ archived: true })]);
    aplicarEventoCru({ type: "ChannelUpdate", id: TOPICO, data: { name: "novo" } });
    expect(lerTopico(TOPICO)).toMatchObject({ nome: "novo", arquivado: true });
  });

  it("`ChannelUpdate` com `thread` substitui a meta inteira", () => {
    anotarCanais([topicoCru({ archived: true })]);
    aplicarEventoCru({
      type: "ChannelUpdate",
      id: TOPICO,
      data: { thread: { parent: FORUM, owner: "01EU", followers: [] } },
    });
    expect(lerTopico(TOPICO)).toMatchObject({
      nome: "bug: rail duplica pasta",
      arquivado: false,
      seguidores: [],
    });
  });

  it("`Message` no post soma a contagem e vira abertura quando não havia", () => {
    anotarCanais([topicoCru()]);
    semearListagem({ [TOPICO]: 0 }, []);
    aplicarEventoCru({
      type: "Message",
      _id: "01MSG",
      channel: TOPICO,
      author: "01EU",
      content: "corpo do post",
    });
    expect(lerContagem(TOPICO)).toBe(1);
    expect(lerTopico(TOPICO)).toMatchObject({ aberturaId: "01MSG", ultimaMensagemId: "01MSG" });
    expect(lerAbertura(TOPICO)?.texto).toBe("corpo do post");

    // A segunda mensagem é resposta: conta, mas não troca a abertura.
    aplicarEventoCru({ type: "Message", _id: "01MSH", channel: TOPICO, author: "01B", content: "r" });
    expect(lerContagem(TOPICO)).toBe(2);
    expect(lerAbertura(TOPICO)?.id).toBe("01MSG");
  });

  it("`Message` em canal que não é tópico não mexe em nada", () => {
    const ouvinte = vi.fn();
    const soltar = assinarMetaDeCanal(ouvinte);
    aplicarEventoCru({ type: "Message", _id: "01X", channel: "01TXT", author: "01A" });
    expect(ouvinte).not.toHaveBeenCalled();
    soltar();
  });

  it("listagem cruza a abertura pelo TÓPICO, não pela mensagem", () => {
    anotarCanais([topicoCru({ message: "01ABRE" })]);
    semearListagem({ [TOPICO]: 7 }, [{ _id: "01ABRE", author: "01A", content: "raiz" }]);
    expect(lerContagem(TOPICO)).toBe(7);
    expect(lerAbertura(TOPICO)?.texto).toBe("raiz");
  });

  it("`ChannelDelete` esquece tópico, contagem e abertura", () => {
    anotarCanais([topicoCru({ message: "01ABRE" })]);
    semearListagem({ [TOPICO]: 3 }, [{ _id: "01ABRE", author: "01A", content: "raiz" }]);
    aplicarEventoCru({ type: "ChannelDelete", id: TOPICO });
    expect(lerTopico(TOPICO)).toBeUndefined();
    expect(lerContagem(TOPICO)).toBeUndefined();
    expect(lerAbertura(TOPICO)).toBeUndefined();
  });
});
