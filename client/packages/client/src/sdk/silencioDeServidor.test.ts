import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, SERVER_ID, seed } from "../dev/firehose";
import {
  channels,
  definirCanalAberto,
  marcarCanalLido,
  marcarTodosLidos,
  servers,
  totaisNaoLidos,
  TOTAIS,
} from "./adapter";
import { client } from "./client";
import {
  alternarSilencio,
  limparSilencio,
  reativarServidor,
  silenciarServidor,
} from "../store/silencio";

/**
 * O silêncio de SERVIDOR na cadeia inteira: store → `channel.muted` → rollup.
 *
 * O que estes testes guardam é a regra do rail — servidor mudo não acende por
 * não-lida, e a menção atravessa — nos três caminhos que escrevem no rollup:
 * a mensagem que chega, o silêncio que muda e o canal que é lido. Cada um
 * falha calado de um jeito diferente, e o terceiro já falhou: a subtração
 * antiga tirava do servidor o que o canal mudo nunca tinha somado.
 */

const GERAL = "01JQ0000000000000000000010";
const LINKS = "01JQ0000000000000000000011";
const EU = "01JQ0000000000000001000000";

const pendentes: FrameRequestCallback[] = [];

let contador = 0;
function falar(channelId: string, conteudo = "oi") {
  const id = `01JQ000000000000000008${String(contador++).padStart(4, "0")}`;
  client.messages.getOrCreate(
    id,
    { _id: id, channel: channelId, author: "01JQ0000000000000001000005", content: conteudo },
    true,
  );
}

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  limparSilencio();
  await seed(4);
  for (const id of [CHANNEL_ID, GERAL, LINKS]) marcarCanalLido(id);
  definirCanalAberto(CHANNEL_ID);
  channels.subscriber(GERAL)(() => {});
  channels.subscriber(LINKS)(() => {});
  servers.subscriber(SERVER_ID)(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("silêncio de servidor", () => {
  it("`channel.muted` responde pelo servidor", () => {
    const canal = client.channels.get(GERAL)!;
    expect(canal.muted).toBe(false);
    silenciarServidor(SERVER_ID);
    expect(canal.muted).toBe(true);
    expect(channels.peek(GERAL)?.silenciado).toBe(true);
    reativarServidor(SERVER_ID);
    expect(canal.muted).toBe(false);
  });

  it("mensagem em servidor mudo conta no canal e não acende o servidor", () => {
    silenciarServidor(SERVER_ID);
    falar(GERAL);
    falar(GERAL);
    expect(channels.peek(GERAL)?.naoLidas).toBe(2);
    expect(servers.peek(SERVER_ID)?.naoLidas ?? 0).toBe(0);
  });

  it("a menção atravessa o silêncio", () => {
    silenciarServidor(SERVER_ID);
    falar(GERAL, `<@${EU}> olha`);
    expect(servers.peek(SERVER_ID)?.mencoes).toBe(1);
  });

  it("silenciar DEPOIS recolhe o que já tinha acendido, e reativar devolve", () => {
    falar(GERAL);
    falar(LINKS);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(2);

    silenciarServidor(SERVER_ID, 60_000);
    expect(servers.peek(SERVER_ID)?.naoLidas ?? 0).toBe(0);

    reativarServidor(SERVER_ID);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(2);
  });

  it("ler um canal mudo não tira do servidor a não-lida de outro canal", () => {
    alternarSilencio(GERAL);
    falar(GERAL);
    falar(LINKS);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(1);

    marcarCanalLido(GERAL);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(1);
  });
});

describe("marcar tudo como lido", () => {
  it("sem socket, zera todos os canais e o total", async () => {
    totaisNaoLidos.subscriber(TOTAIS)(() => {});
    falar(GERAL);
    falar(LINKS, `<@${EU}>`);
    expect(totaisNaoLidos.peek(TOTAIS)?.naoLidas).toBeGreaterThan(0);

    const r = await marcarTodosLidos();

    expect(r).toEqual({ total: 2, falhas: 0 });
    expect(channels.peek(GERAL)?.naoLidas).toBe(0);
    expect(channels.peek(LINKS)?.mencoes).toBe(0);
    expect(servers.peek(SERVER_ID)?.naoLidas ?? 0).toBe(0);
    expect(totaisNaoLidos.peek(TOTAIS)).toEqual({ naoLidas: 0, mencoes: 0 });
  });

  it("nada por ler: não faz nada", async () => {
    expect(await marcarTodosLidos()).toEqual({ total: 0, falhas: 0 });
  });
});
