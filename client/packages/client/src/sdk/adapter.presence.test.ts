import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionState } from "stoat.js";

import { CHANNEL_ID, SERVER_ID, seed } from "../dev/firehose";
import { definirCanalAberto, membrosOnline, presence } from "./adapter";
import { client } from "./client";

const pendentes: FrameRequestCallback[] = [];

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("presença ao vivo", () => {
  beforeEach(async () => {
    await seed(4);
  });

  it("userUpdate muda o snapshot só daquele userId", async () => {
    const online = membrosOnline.peek(SERVER_ID) ?? [];
    const alvo = online[0]!;
    const outro = online[1]!;
    const user = client.users.get(alvo)!;

    const snapAlvo = () => presence.getSnapshot(alvo);
    const refOutro = presence.getSnapshot(outro);
    const novo = snapAlvo() === "idle" ? "dnd" : "idle";

    await new Promise((r) => setTimeout(r, 130));

    const ouviuAlvo = vi.fn();
    const ouviuOutro = vi.fn();
    presence.subscriber(alvo)(ouviuAlvo);
    presence.subscriber(outro)(ouviuOutro);

    client.users.updateUnderlyingObject(alvo, {
      online: true,
      status: { presence: novo === "dnd" ? "Busy" : "Idle" },
    } as never);
    client.emit("userUpdate", user, {} as never);

    expect(snapAlvo()).toBe(novo);
    expect(Object.is(presence.getSnapshot(outro), refOutro)).toBe(true);

    await new Promise((r) => setTimeout(r, 130));
    expect(ouviuAlvo).toHaveBeenCalledTimes(1);
    expect(ouviuOutro).not.toHaveBeenCalled();
  });

  it("abrir um canal de servidor manda Subscribe", () => {
    const canal = client.channels.get(CHANNEL_ID)!;
    vi.spyOn(canal, "ack").mockResolvedValue(undefined);
    vi.spyOn(client.events, "state").mockReturnValue(ConnectionState.Connected);
    const send = vi.spyOn(client.events, "send").mockImplementation(() => {});

    definirCanalAberto(undefined);
    definirCanalAberto(CHANNEL_ID);

    expect(send).toHaveBeenCalledWith({
      type: "Subscribe",
      server_id: SERVER_ID,
    });
  });
});
