import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ulid } from "ulid";

import { seed } from "../dev/firehose";
import { channelMessageIds, messages, usuarioLocalId } from "./adapter";
import { client } from "./client";
import {
  ehEntradaNoTopico,
  JANELA_DE_AGRUPAMENTO_MS,
  juntarOuAbrir,
  limparEntradasNoTopico,
  quemEntrou,
  recorteDaFrase,
  registrarEntrada,
} from "./entradasNoTopico";
import { lerTopico, topicosConhecidos } from "./vortexCanal";

/**
 * "🧵 Rafa e Nando entraram no tópico" (D-CANAIS-23).
 *
 * Duas metades, como `eventosDaSala.test.ts`: a DECISÃO pura e a PONTE até a
 * lista pelo `EventClient` de verdade — é a ponte que quebra em silêncio.
 */

describe("quem entrou", () => {
  const sem = { eu: undefined, respondeu: undefined };

  it("é a diferença entre as listas, na ordem do servidor", () => {
    expect(quemEntrou(["A"], ["A", "B", "C"], sem)).toEqual(["B", "C"]);
  });

  it("sair não é entrar", () => {
    expect(quemEntrou(["A", "B"], ["A"], sem)).toEqual([]);
  });

  it("sem a lista de antes, ninguém — senão o Ready vira avalanche", () => {
    expect(quemEntrou(undefined, ["A", "B"], sem)).toEqual([]);
  });

  it("você e quem entrou respondendo ficam de fora", () => {
    expect(quemEntrou(["A"], ["A", "EU", "RAFA", "NANDO"], { eu: "EU", respondeu: "RAFA" })).toEqual([
      "NANDO",
    ]);
  });
});

describe("juntar entradas seguidas", () => {
  beforeEach(() => limparEntradasNoTopico());
  const T = "01TOPICO";

  it("junta na linha de entrada que é a última da conversa, sem repetir", () => {
    const id = ulid();
    registrarEntrada(id, T, ["RAFA"]);
    expect(juntarOuAbrir(id, T, ["NANDO", "RAFA"], Date.now())).toEqual({
      juntarEm: id,
      userIds: ["RAFA", "NANDO"],
    });
  });

  it("mensagem no meio, outro tópico ou fora da janela abrem linha nova", () => {
    const id = ulid();
    registrarEntrada(id, T, ["RAFA"]);
    expect(juntarOuAbrir(ulid(), T, ["NANDO"], Date.now())).toBeUndefined();
    expect(juntarOuAbrir(id, "01OUTRO", ["NANDO"], Date.now())).toBeUndefined();
    expect(juntarOuAbrir(id, T, ["NANDO"], Date.now() + JANELA_DE_AGRUPAMENTO_MS + 1_000)).toBeUndefined();
  });
});

describe("recorte da frase", () => {
  it("até três nomes; depois, dois e 'mais N'", () => {
    expect(recorteDaFrase(["A", "B"])).toEqual({ nomes: ["A", "B"], resto: 0 });
    expect(recorteDaFrase(["A", "B", "C"])).toEqual({ nomes: ["A", "B", "C"], resto: 0 });
    expect(recorteDaFrase(["A", "B", "C", "D", "E"])).toEqual({ nomes: ["A", "B"], resto: 3 });
  });
});

describe("ponte até a lista", () => {
  let quadro: FrameRequestCallback | undefined;
  function publicar() {
    const cb = quadro;
    quadro = undefined;
    cb?.(0);
  }

  let topico = "";
  let soltar: () => void = () => {};

  beforeEach(async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      quadro = cb;
      return 1;
    });
    await seed(4);
    publicar();
    limparEntradasNoTopico();
    /* Um tópico que ninguém abriu não recebe linha — então este é "aberto". */
    topico = [...topicosConhecidos()].find(([, m]) => !m.arquivado)![0];
    soltar = channelMessageIds.subscriber(topico)(() => {});
  });

  afterEach(() => {
    soltar();
    vi.unstubAllGlobals();
  });

  function seguir(...novos: string[]) {
    const m = lerTopico(topico)!;
    client.events.emit("event", {
      type: "ChannelUpdate",
      id: topico,
      data: {
        thread: {
          parent: m.paiId,
          owner: m.donoId,
          message: m.aberturaId,
          archived: false,
          tags: m.tags,
          followers: [...m.seguidores, ...novos],
        },
      },
      clear: [],
    } as never);
    publicar();
  }

  function ultima() {
    const ids = channelMessageIds.peek(topico) ?? [];
    const id = ids[ids.length - 1]!;
    messages.subscriber(id)(() => {});
    return { id, total: ids.length, sistema: messages.peek(id)?.sistema };
  }

  /* Pessoa NOVA a cada teste: o registro de tópicos sobrevive entre eles, e
     quem já segue não entra de novo. */
  it("seguir vira linha de sistema no fim da conversa, fora do cursor de leitura", () => {
    const rafa = ulid();
    const antes = channelMessageIds.peek(topico)?.length ?? 0;
    seguir(rafa);
    const l = ultima();
    expect(l.total).toBe(antes + 1);
    expect(ehEntradaNoTopico(l.id)).toBe(true);
    expect(l.sistema).toEqual({ tipo: "entrouNoTopico", userIds: [rafa] });
  });

  it("a segunda entrada se junta à primeira — 'Rafa e Nando'", () => {
    const [rafa, nando] = [ulid(), ulid()];
    const antes = channelMessageIds.peek(topico)?.length ?? 0;
    seguir(rafa);
    const primeira = ultima();
    expect(primeira.total).toBe(antes + 1);
    seguir(nando);
    const l = ultima();
    expect(l.total).toBe(antes + 1);
    expect(l.id).toBe(primeira.id);
    expect(l.sistema).toEqual({ tipo: "entrouNoTopico", userIds: [rafa, nando] });
  });

  it("eu mesmo seguindo não escreve nada", () => {
    const eu = usuarioLocalId();
    expect(eu).toBeDefined();
    const antes = channelMessageIds.peek(topico)?.length ?? 0;
    seguir(eu!);
    expect(channelMessageIds.peek(topico)?.length ?? 0).toBe(antes);
  });

  it("tópico que ninguém abriu não ganha lista por causa de um seguir", () => {
    /* OUTRO tópico: o dos testes acima já tem linhas, e lista na memória é
       justamente o caso em que a entrada entra. */
    soltar();
    soltar = () => {};
    topico = [...topicosConhecidos()].filter(([, m]) => !m.arquivado)[1]![0];
    expect(channelMessageIds.peek(topico)?.length ?? 0).toBe(0);
    seguir(ulid());
    expect(channelMessageIds.peek(topico)?.length ?? 0).toBe(0);
  });
});
