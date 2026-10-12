import { monotonicFactory } from "ulid";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../arnes/firehose";
import { apagarMensagem, channelMessageIds, prependHistory } from "./adapter";
import { client } from "./client";

/**
 * As duas invariantes que o spike descobriu medindo, e que até aqui viviam
 * como prosa no enforcement.md.
 *
 * Nenhuma das duas dá erro quando quebra. A primeira degrada em carga
 * quadrática; a segunda destrói a âncora da lista e o sintoma parece
 * reatividade quebrada, que foi exatamente o diagnóstico errado que custou
 * mais que o bug.
 */

const proximoId = monotonicFactory();

/** `requestAnimationFrame` não existe em node. Coletar e disparar à mão é o
 *  que torna a coalescência observável em vez de dependente de timing. */
let pendentes: FrameRequestCallback[] = [];

beforeEach(() => {
  pendentes = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function virarFrame() {
  const fila = pendentes;
  pendentes = [];
  for (const cb of fila) cb(0);
}

function criarMensagem(n: number) {
  const id = proximoId();
  client.messages.getOrCreate(
    id,
    {
      _id: id,
      channel: CHANNEL_ID,
      author: "01JQ0000000000000000000000",
      content: `mensagem ${n}`,
    },
    true,
  );
  return id;
}

describe("publicação da lista de IDs", () => {
  it("carga em massa publica uma vez, não uma por mensagem", async () => {
    const publicacoes = vi.fn();
    channelMessageIds.subscriber(CHANNEL_ID)(publicacoes);

    await seed(500);
    virarFrame();

    // Assinar o SDK antes de carregar faz a lista crescer evento a evento; a
    // publicação final, em bloco, então salta de N para o total e destrói a
    // âncora. `seed` liga o adapter só DEPOIS da carga, por isso aqui cai
    // exatamente uma publicação.
    expect(publicacoes).toHaveBeenCalledTimes(1);
    expect(channelMessageIds.getSnapshot(CHANNEL_ID)).toHaveLength(500);
  });

  it("coalesce por frame: N mensagens no mesmo tick viram uma publicação", () => {
    const publicacoes = vi.fn();
    channelMessageIds.subscriber(CHANNEL_ID)(publicacoes);

    for (let i = 0; i < 40; i++) criarMensagem(i);

    // Antes do frame, nada foi publicado: o custo é adiado, não pago por evento.
    expect(publicacoes).not.toHaveBeenCalled();

    virarFrame();
    expect(publicacoes).toHaveBeenCalledTimes(1);
  });

  it("publica de novo no frame seguinte, não só uma vez na vida", () => {
    const publicacoes = vi.fn();
    channelMessageIds.subscriber(CHANNEL_ID)(publicacoes);

    criarMensagem(1);
    virarFrame();
    criarMensagem(2);
    virarFrame();

    expect(publicacoes).toHaveBeenCalledTimes(2);
  });

  it("frame sem mensagem nova não publica", () => {
    const publicacoes = vi.fn();
    channelMessageIds.subscriber(CHANNEL_ID)(publicacoes);

    virarFrame();

    expect(publicacoes).not.toHaveBeenCalled();
  });
});

describe("prepend de histórico", () => {
  it("entra na frente, preservando a ordem entre as antigas", () => {
    const antes = channelMessageIds.getSnapshot(CHANNEL_ID) ?? [];
    const primeiraAtual = antes[0];

    prependHistory(CHANNEL_ID, ["velha-1", "velha-2", "velha-3"]);
    virarFrame();

    const depois = channelMessageIds.getSnapshot(CHANNEL_ID) ?? [];
    expect(depois.slice(0, 3)).toEqual(["velha-1", "velha-2", "velha-3"]);
    expect(depois[3]).toBe(primeiraAtual);
    expect(depois).toHaveLength(antes.length + 3);
  });

  it("coalesce como o append: duas páginas no mesmo tick, uma publicação", () => {
    const publicacoes = vi.fn();
    channelMessageIds.subscriber(CHANNEL_ID)(publicacoes);

    // Rolar rápido para cima dispara paginação em rajada. Uma publicação por
    // página seria o mesmo custo quadrático que a carga tinha.
    prependHistory(CHANNEL_ID, ["pagina-a-1", "pagina-a-2"]);
    prependHistory(CHANNEL_ID, ["pagina-b-1", "pagina-b-2"]);

    expect(publicacoes).not.toHaveBeenCalled();
    virarFrame();
    expect(publicacoes).toHaveBeenCalledTimes(1);
  });

  it("página vazia não publica nem toca a lista", () => {
    const publicacoes = vi.fn();
    channelMessageIds.subscriber(CHANNEL_ID)(publicacoes);
    const antes = channelMessageIds.getSnapshot(CHANNEL_ID);

    // O fim do histórico devolve uma página vazia. Publicar aí faria a lista
    // remedir à toa a cada tentativa de carregar além do começo.
    prependHistory(CHANNEL_ID, []);
    virarFrame();

    expect(publicacoes).not.toHaveBeenCalled();
    expect(Object.is(antes, channelMessageIds.getSnapshot(CHANNEL_ID))).toBe(true);
  });
});

describe("apagar mensagem otimista", () => {
  const ids = () => [...(channelMessageIds.getSnapshot(CHANNEL_ID) ?? [])];

  /** Troca o `delete` do SDK por um controlável. */
  function prender(id: string) {
    const msg = client.messages.get(id)!;
    let resolver!: () => void;
    let rejeitar!: (e: unknown) => void;
    (msg as unknown as { delete: () => Promise<void> }).delete = () =>
      new Promise<void>((res, rej) => {
        resolver = res;
        rejeitar = rej;
      });
    return { resolver: () => resolver(), rejeitar: (e: unknown) => rejeitar(e) };
  }

  beforeEach(async () => {
    await seed(8);
    virarFrame();
  });

  it("a linha some na hora, antes do DELETE responder", async () => {
    const todas = ids();
    const alvo = todas[todas.length - 3]!;
    const delete_ = prender(alvo);

    const resultado = apagarMensagem(alvo);
    virarFrame();
    expect(ids()).toEqual(todas.filter((i) => i !== alvo));

    delete_.resolver();
    await expect(resultado).resolves.toBe(true);
    virarFrame();
    expect(ids()).not.toContain(alvo);
  });

  it("DELETE que falha devolve a linha no mesmo lugar", async () => {
    const todas = ids();
    const alvo = todas[todas.length - 3]!;
    const delete_ = prender(alvo);

    const resultado = apagarMensagem(alvo);
    virarFrame();
    // Chega mensagem nova enquanto o DELETE voa: o índice antigo envelheceu.
    criarMensagem(999);

    delete_.rejeitar(new Error("403"));
    await expect(resultado).resolves.toBe(false);
    virarFrame();

    const depois = ids();
    expect(depois.indexOf(alvo)).toBe(todas.indexOf(alvo));
    expect(depois).toHaveLength(todas.length + 1);
    expect(new Set(depois).size).toBe(depois.length);
  });

  it("devolver a primeira linha vai para o começo", async () => {
    const todas = ids();
    const alvo = todas[0]!;
    const delete_ = prender(alvo);
    const resultado = apagarMensagem(alvo);
    virarFrame();
    expect(ids()[0]).not.toBe(alvo);
    delete_.rejeitar(new Error("500"));
    await resultado;
    virarFrame();
    expect(ids()[0]).toBe(alvo);
  });

  it("o eco MessageDelete depois de apagar não remove de novo nem lança", async () => {
    const todas = ids();
    const alvo = todas[todas.length - 2]!;
    const delete_ = prender(alvo);
    const resultado = apagarMensagem(alvo);
    virarFrame();
    delete_.resolver();
    await resultado;

    const emitir = (client as unknown as { emit: (n: string, m: unknown) => void }).emit;
    expect(() => emitir.call(client, "messageDelete", { id: alvo, channelId: CHANNEL_ID })).not.toThrow();
    virarFrame();
    expect(ids()).toEqual(todas.filter((i) => i !== alvo));
  });

  it("eco que chega antes de um DELETE que falha: não ressuscita", async () => {
    const todas = ids();
    const alvo = todas[todas.length - 2]!;
    const delete_ = prender(alvo);
    const resultado = apagarMensagem(alvo);
    virarFrame();

    const emitir = (client as unknown as { emit: (n: string, m: unknown) => void }).emit;
    emitir.call(client, "messageDelete", { id: alvo, channelId: CHANNEL_ID });
    delete_.rejeitar(new Error("404"));
    await resultado;
    virarFrame();
    expect(ids()).not.toContain(alvo);
  });
});
