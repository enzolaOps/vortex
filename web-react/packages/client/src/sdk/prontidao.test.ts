import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { channels, servers } from "./adapter";
import { ReactiveSet } from "@solid-primitives/set";

import { client } from "./client";

/**
 * O estado de leitura que o SERVIDOR conhece, na entrada.
 *
 * O briefing chamava a ausência disto de "regressão garantida", e a razão é
 * que a contagem só sabia do que chegou AO VIVO: o adapter incrementa `+1` por
 * `messageCreate`. O que chegou enquanto o app estava fechado — a maior parte
 * do que interessa ao abrir — nunca passou por ali, e o app abria zerado sobre
 * um histórico cheio.
 *
 * Sem backend, o `Ready` é simulado escrevendo em `client.channelUnreads` o
 * que o servidor escreveria e emitindo o evento. É simulação do PROTOCOLO, não
 * do nosso código.
 */

const pendentes: FrameRequestCallback[] = [];

function virarFrame() {
  pendentes.splice(0, pendentes.length).forEach((cb) => cb(0));
}

/** O que o servidor manda no `Ready` para um canal. */
function unreadDoServidor(
  channelId: string,
  lastMessageId: string,
  mencoes: string[] = [],
) {
  client.channelUnreads.getOrCreate(channelId, {
    _id: { channel: channelId, user: "eu" },
    last_id: lastMessageId,
    mentions: mencoes,
  });
  /*
    E ESCREVE, porque `getOrCreate` não re-hidrata.

    O objeto é module-level no SDK e sobrevive entre testes: o segundo teste
    recebia o unread do primeiro, sem menção nenhuma. O sintoma era "menções
    vêm por ID" falhando com zero, o que parecia o mapeamento do adapter
    ignorando o campo.
  */
  client.channelUnreads.updateUnderlyingObject(channelId, {
    lastMessageId,
    messageMentionIds: new ReactiveSet(mencoes),
  });
}

beforeEach(async () => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
  await seed(10);
  virarFrame();
});

describe("semeadura de não lidas no Ready", () => {
  it("cursor atrás da última vira canal não lido", () => {
    // O canal que o arnês semeou — é o único com `lastMessageId`, que é o que
    // permite saber se o cursor ficou para trás.
    const canal = client.channels.get(CHANNEL_ID)!;
    // Um cursor que não é a última: existe coisa por ler.
    unreadDoServidor(canal.id, "01ANTIGO0000000000000000AA");

    client.emit("ready");
    virarFrame();

    const parar = channels.subscriber(canal.id)(() => {});
    expect(channels.getSnapshot(canal.id)?.naoLidas).toBeGreaterThan(0);
    parar();
  });

  it("menções vêm por ID e são contadas exatamente", () => {
    /*
      A parte que o número inventado não consegue: quantas não lidas existem só
      se sabe carregando o histórico, mas quantas MENÇÕES o servidor já disse,
      porque elas vêm como conjunto de IDs.
    */
    const canal = client.channels.get(CHANNEL_ID)!;
    unreadDoServidor(canal.id, "01ANTIGO0000000000000000AA", [
      "01M0000000000000000000000A",
      "01M0000000000000000000000B",
    ]);

    client.emit("ready");
    virarFrame();

    const parar = channels.subscriber(canal.id)(() => {});
    expect(channels.getSnapshot(canal.id)?.mencoes).toBe(2);
    parar();
  });

  it("o servidor herda a contagem dos canais dele", () => {
    const canal = client.channels.get(CHANNEL_ID)!;
    const parar = servers.subscriber(canal.serverId)(() => {});
    // Relativo, não absoluto: o firehose já produz menções ao vivo, e um
    // número fixo aqui testaria o arnês em vez do código.
    const antes = servers.getSnapshot(canal.serverId)?.mencoes ?? 0;

    unreadDoServidor(canal.id, "01ANTIGO0000000000000000AA", [
      "01M0000000000000000000000A",
    ]);
    client.emit("ready");
    virarFrame();

    expect(servers.getSnapshot(canal.serverId)?.mencoes).toBe(antes + 1);
    parar();
  });
});
