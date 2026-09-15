import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { indiceDaTecla } from "../expressoes/atalhos";
import { nomeDoArquivo } from "../expressoes/nomes";
import { lerRecentes, MAXIMO_DE_RECENTES, usarFigurinha } from "../expressoes/recentes";
import { definirChamada, limparChamada } from "../store/chamada";
import { channelMessageIds, enviarFigurinha, messages } from "./adapter";
import { bitDaPermissao } from "./cargos";
import { client } from "./client";
import { aoTocarNaSala, podeUsarSoundboard, volumeFinal } from "./efeitosSonoros";
import {
  aplicarEventoDeExpressao,
  figurinhasDoServidor,
  limitesDeExpressoes,
  paraEfeitoSonoro,
  paraFigurinha,
  semearExpressoes,
  sonsDoServidor,
  type Figurinha,
} from "./expressoes";
import { anotarFigurinhas, figurinhaDaMensagem, limparFigurinhasDeMensagem } from "./figurinhasDeMensagem";

/**
 * Figurinhas e efeitos sonoros — conceitos do fork que o `stoat.js` não conhece.
 *
 * O que quebra em silêncio aqui é a TRADUÇÃO (um campo renomeado no protocolo
 * vira `undefined` e a figurinha some da linha) e a LEITURA CRUA que recupera o
 * que o SDK descarta. É isso que os testes guardam.
 */

const bruta = (over: Record<string, unknown> = {}) => ({
  _id: "01FIG",
  server: "01SRV",
  creator_id: "01USR",
  name: "deu ruim",
  description: "quando falha",
  emoji: "🙃",
  content_type: "image/png",
  filename: "deu-ruim.png",
  ...over,
});

const figurinha = (id: string, nome = id): Figurinha => ({
  id,
  serverId: "01SRV",
  nome,
  descricao: undefined,
  emoji: undefined,
  url: undefined,
  autorId: "",
  autorNome: undefined,
});

describe("tradução do protocolo", () => {
  it("figurinha: nomes do protocolo viram domínio", () => {
    const f = paraFigurinha(bruta());
    expect(f).toMatchObject({
      id: "01FIG",
      serverId: "01SRV",
      nome: "deu ruim",
      descricao: "quando falha",
      emoji: "🙃",
      autorId: "01USR",
    });
  });

  it("figurinha sem id, servidor ou nome é recusada, não meio-montada", () => {
    expect(paraFigurinha(bruta({ _id: undefined }))).toBeUndefined();
    expect(paraFigurinha(bruta({ server: "" }))).toBeUndefined();
    expect(paraFigurinha(bruta({ name: 3 }))).toBeUndefined();
    expect(paraFigurinha(null)).toBeUndefined();
  });

  it("som: volume fica entre 0 e 100, e ausente vale 100", () => {
    expect(paraEfeitoSonoro(bruta({ volume: 250 }))?.volume).toBe(100);
    expect(paraEfeitoSonoro(bruta({ volume: -5 }))?.volume).toBe(0);
    expect(paraEfeitoSonoro(bruta({ volume: undefined }))?.volume).toBe(100);
    expect(paraEfeitoSonoro(bruta({ volume: 55 }))?.volume).toBe(55);
  });

  it("limites caem nos padrões do servidor quando a instância não publica", () => {
    expect(limitesDeExpressoes()).toEqual({
      figurinhas: 15,
      sons: 8,
      bytesDeFigurinha: 512_000,
      bytesDeSom: 512_000,
    });
  });
});

describe("eventos crus nas listas", () => {
  beforeEach(() => {
    semearExpressoes("01SRV", { figurinhas: [figurinha("a")], sons: [] });
  });

  it("create acrescenta num ARRAY NOVO", () => {
    const antes = figurinhasDoServidor.peek("01SRV");
    const itensAntes = antes?.estado === "pronta" ? antes.itens : undefined;
    aplicarEventoDeExpressao({ type: "StickerCreate", ...bruta({ _id: "b" }) });
    const depois = figurinhasDoServidor.peek("01SRV");
    expect(depois).not.toBe(antes);
    // O array ANTIGO fica intacto: quem ainda o segura (um render em curso)
    // não pode vê-lo mudar debaixo de si.
    expect(itensAntes?.map((f) => f.id)).toEqual(["a"]);
    expect(depois?.estado === "pronta" && depois.itens.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("update troca no lugar, sem duplicar", () => {
    aplicarEventoDeExpressao({ type: "StickerUpdate", ...bruta({ _id: "a", name: "novo" }) });
    const lista = figurinhasDoServidor.peek("01SRV");
    expect(lista?.estado === "pronta" && lista.itens.map((f) => [f.id, f.nome])).toEqual([
      ["a", "novo"],
    ]);
  });

  it("delete remove pelo servidor do evento", () => {
    aplicarEventoDeExpressao({ type: "StickerDelete", id: "a", server: "01SRV" });
    const lista = figurinhasDoServidor.peek("01SRV");
    expect(lista?.estado === "pronta" && lista.itens).toEqual([]);
  });

  it("não inventa lista para servidor que ninguém carregou", () => {
    aplicarEventoDeExpressao({ type: "SoundboardSoundCreate", ...bruta({ server: "01OUTRO" }) });
    expect(sonsDoServidor.peek("01OUTRO")).toBeUndefined();
  });

  it("evento de som entra na lista de sons, não na de figurinhas", () => {
    aplicarEventoDeExpressao({ type: "SoundboardSoundCreate", ...bruta({ _id: "s1" }) });
    const sons = sonsDoServidor.peek("01SRV");
    expect(sons?.estado === "pronta" && sons.itens.map((s) => s.id)).toEqual(["s1"]);
    const figs = figurinhasDoServidor.peek("01SRV");
    expect(figs?.estado === "pronta" && figs.itens.length).toBe(1);
  });
});

describe("figurinha que o SDK descarta", () => {
  beforeEach(() => limparFigurinhasDeMensagem());

  it("anota pelo _id E pelo nonce — a otimista e a confirmada acham a mesma", () => {
    anotarFigurinhas({ messages: [{ _id: "SRV1", nonce: "LOCAL1", stickers: ["F1"] }] });
    expect(figurinhaDaMensagem("SRV1")).toBe("F1");
    expect(figurinhaDaMensagem("OUTRO", "LOCAL1")).toBe("F1");
  });

  it("lista solta e mensagem sem figurinha", () => {
    anotarFigurinhas([{ _id: "M1", stickers: ["F2"] }, { _id: "M2" }, { _id: "M3", stickers: [] }]);
    expect(figurinhaDaMensagem("M1")).toBe("F2");
    expect(figurinhaDaMensagem("M2")).toBeUndefined();
    expect(figurinhaDaMensagem("M3")).toBeUndefined();
  });
});

describe("figurinha chegando DEPOIS do snapshot", () => {
  const pendentes: FrameRequestCallback[] = [];

  beforeEach(async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      pendentes.push(cb);
      return pendentes.length;
    });
    await seed(30);
    pendentes.splice(0, pendentes.length).forEach((cb) => cb(0));
  });

  it("o evento cru republica a linha que já estava na tela", () => {
    const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
    const id = ids[ids.length - 1]!;
    const parar = messages.subscriber(id)(() => {});
    expect(messages.getSnapshot(id)?.figurinha).toBeUndefined();

    client.events.emit("event", { type: "Message", _id: id, channel: CHANNEL_ID, stickers: ["01FIGX"] } as never);

    expect(messages.getSnapshot(id)?.figurinha).toBe("01FIGX");
    parar();
  });

  it("enviar uma figurinha cria a otimista JÁ com ela, sem texto", () => {
    const id = enviarFigurinha(CHANNEL_ID, "01FIGY");
    expect(id).toBeDefined();
    pendentes.splice(0, pendentes.length).forEach((cb) => cb(0));
    const parar = messages.subscriber(id!)(() => {});
    const m = messages.getSnapshot(id!);
    expect(m?.figurinha).toBe("01FIGY");
    expect(m?.content).toBe("");
    expect(m?.sendState).toBe("pending");
    parar();
  });
});

describe("tocar para a sala", () => {
  beforeEach(() => limparChamada());

  it("volume final multiplica origem e painel", () => {
    expect(volumeFinal(80, 50)).toBeCloseTo(0.4);
    expect(volumeFinal(100, 100)).toBe(1);
    expect(volumeFinal(0, 100)).toBe(0);
  });

  const evento = (channel_id: string, user_id = "01OUTRA") => ({
    channel_id,
    user_id,
    sound: bruta({ _id: "S", volume: 50 }),
  });

  it("toca só dentro da chamada DAQUELE canal", () => {
    const tocar = vi.fn();
    expect(aoTocarNaSala(evento("C1"), tocar)).toBe(false);

    definirChamada({ estado: "dentro", channelId: "C1" });
    expect(aoTocarNaSala(evento("C2"), tocar)).toBe(false);
    expect(aoTocarNaSala(evento("C1"), tocar)).toBe(true);
    expect(tocar).toHaveBeenCalledTimes(1);
  });

  it("surdo não ouve os sons da sala", () => {
    const tocar = vi.fn();
    definirChamada({ estado: "dentro", channelId: "C1", surdo: true });
    expect(aoTocarNaSala(evento("C1"), tocar)).toBe(false);
    expect(tocar).not.toHaveBeenCalled();
  });

  it("quem tocou não ouve de novo pelo eco do evento", () => {
    const tocar = vi.fn();
    definirChamada({ estado: "dentro", channelId: "C1" });
    Object.defineProperty(client, "user", { value: { id: "01EU" }, configurable: true });
    try {
      expect(aoTocarNaSala(evento("C1", "01EU"), tocar)).toBe(false);
      expect(aoTocarNaSala(evento("C1", "01OUTRA"), tocar)).toBe(true);
      expect(tocar).toHaveBeenCalledTimes(1);
    } finally {
      delete (client as { user?: unknown }).user;
    }
  });

  it("tocar para a sala pede Speak E UseSoundboard, as duas", () => {
    let permissao = 0n;
    const get = vi
      .spyOn(client.channels, "get")
      .mockImplementation(() => ({ permission: permissao }) as never);
    Object.defineProperty(client, "user", { value: { id: "01EU" }, configurable: true });
    try {
      const falar = 1n << 31n;
      const soundboard = 1n << 43n;
      permissao = falar;
      expect(podeUsarSoundboard("C1")).toBe(false);
      permissao = soundboard;
      expect(podeUsarSoundboard("C1")).toBe(false);
      permissao = falar | soundboard;
      expect(podeUsarSoundboard("C1")).toBe(true);
    } finally {
      get.mockRestore();
      delete (client as { user?: unknown }).user;
    }
  });

  it("o bit de UseSoundboard é o 43 do fork", () => {
    expect(bitDaPermissao("UseSoundboard")).toBe(1n << 43n);
  });
});

describe("teclas 1–9", () => {
  const tecla = (key: string, over: Partial<Parameters<typeof indiceDaTecla>[0]> = {}) =>
    indiceDaTecla({ key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, target: null, ...over });

  it("dígito vira índice", () => {
    expect(tecla("1")).toBe(0);
    expect(tecla("9")).toBe(8);
    expect(tecla("0")).toBeUndefined();
    expect(tecla("a")).toBeUndefined();
  });

  it("não rouba o dígito de quem digita, nem com modificador ou tecla segurada", () => {
    expect(tecla("1", { target: document.createElement("textarea") })).toBeUndefined();
    expect(tecla("1", { target: document.createElement("input") })).toBeUndefined();
    expect(tecla("1", { ctrlKey: true })).toBeUndefined();
    expect(tecla("1", { repeat: true })).toBeUndefined();
    expect(tecla("1", { target: document.createElement("div") })).toBe(0);
  });
});

describe("recentes e nomes", () => {
  it("a usada vai para a frente, sem duplicar, com teto", () => {
    for (let i = 0; i < MAXIMO_DE_RECENTES + 2; i++) usarFigurinha(`f${String(i)}`);
    usarFigurinha("f3");
    const r = lerRecentes();
    expect(r[0]).toBe("f3");
    expect(r.length).toBe(MAXIMO_DE_RECENTES);
    expect(new Set(r).size).toBe(r.length);
  });

  it("nome do arquivo perde extensão e separadores, mantém acento", () => {
    expect(nomeDoArquivo("deu-ruim_de_novo.png")).toBe("deu ruim de novo");
    expect(nomeDoArquivo("ação.apng")).toBe("ação");
    expect(nomeDoArquivo(".png")).toBe("figurinha");
  });
});
