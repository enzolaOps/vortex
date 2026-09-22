import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seed } from "../dev/firehose";
import { definirChamada, limparChamada } from "../store/chamada";
import { channelMessageIds, messages } from "./adapter";
import { client } from "./client";
import {
  VALIDADE_DO_AUTOR_MS,
  anotarAutorDeVoz,
  ehLinhaDeSala,
  limparEventosDaSala,
  linhasDoEvento,
} from "./eventosDaSala";

/**
 * Entrou, saiu, foi movido — as linhas do chat da sala (D-VOZ-13, D-LAC-27).
 *
 * Duas metades, como `chamadaRecebida.test.ts`: a TRADUÇÃO pura do evento cru
 * e a PONTE até a lista, pelo `EventClient` de verdade. É a ponte que quebra
 * em silêncio — um filtro errado e a linha simplesmente não aparece.
 */

const SALA = "01JQ0000000000000000000014";
const OUTRA = "01JQ0000000000000000000012";

function estado(id: string) {
  return {
    id,
    joined_at: new Date().toISOString(),
    is_receiving: true,
    is_publishing: true,
    screensharing: false,
    camera: false,
  };
}

describe("tradução do evento cru", () => {
  beforeEach(() => limparEventosDaSala());

  it("fora de chamada nada vira linha", () => {
    expect(linhasDoEvento({ type: "VoiceChannelJoin", id: SALA, state: estado("JU") }, "", 0)).toEqual(
      [],
    );
  });

  it("só a sala em que se está", () => {
    expect(
      linhasDoEvento({ type: "VoiceChannelJoin", id: OUTRA, state: estado("JU") }, SALA, 0),
    ).toEqual([]);
    expect(
      linhasDoEvento({ type: "VoiceChannelJoin", id: SALA, state: estado("JU") }, SALA, 0),
    ).toEqual([{ canal: SALA, userId: "JU", sistema: { tipo: "entrou", userId: "JU" } }]);
  });

  it("saída espontânea é `saiu`; com autor recente é `desconectou`", () => {
    expect(linhasDoEvento({ type: "VoiceChannelLeave", id: SALA, user: "NANDO" }, SALA, 0)).toEqual([
      { canal: SALA, userId: "NANDO", sistema: { tipo: "saiu", userId: "NANDO" } },
    ]);

    anotarAutorDeVoz(
      { type: "ServerMemberUpdate", id: { server: "S", user: "NANDO" }, data: {}, by: "ANA" },
      1000,
    );
    expect(
      linhasDoEvento({ type: "VoiceChannelLeave", id: SALA, user: "NANDO" }, SALA, 2000)[0]?.sistema,
    ).toEqual({ tipo: "desconectou", userId: "NANDO", porId: "ANA" });
  });

  it("o autor vence e é consumido", () => {
    anotarAutorDeVoz({ type: "ServerMemberUpdate", id: { user: "TEO" }, by: "ANA" }, 0);
    const velho = linhasDoEvento(
      { type: "VoiceChannelLeave", id: SALA, user: "TEO" },
      SALA,
      VALIDADE_DO_AUTOR_MS + 1,
    );
    expect(velho[0]?.sistema.tipo).toBe("saiu");

    anotarAutorDeVoz({ type: "ServerMemberUpdate", id: { user: "TEO" }, by: "ANA" }, 0);
    linhasDoEvento({ type: "VoiceChannelLeave", id: SALA, user: "TEO" }, SALA, 1);
    // Segunda saída não herda o "por" da primeira.
    expect(
      linhasDoEvento({ type: "VoiceChannelLeave", id: SALA, user: "TEO" }, SALA, 2)[0]?.sistema.tipo,
    ).toBe("saiu");
  });

  it("movimento entra de qualquer lado, com ou sem autor", () => {
    const mov = { type: "VoiceChannelMove", user: "TEO", from: SALA, to: OUTRA, state: estado("TEO") };
    expect(linhasDoEvento(mov, SALA, 0)[0]?.sistema).toEqual({
      tipo: "moveu",
      userId: "TEO",
      porId: undefined,
      paraId: OUTRA,
    });
    anotarAutorDeVoz({ type: "ServerMemberUpdate", id: { user: "TEO" }, by: "ANA" }, 0);
    expect(linhasDoEvento(mov, OUTRA, 10)[0]?.sistema).toEqual({
      tipo: "moveu",
      userId: "TEO",
      porId: "ANA",
      paraId: OUTRA,
    });
    expect(linhasDoEvento(mov, "01TERCEIRA", 0)).toEqual([]);
  });

  it("começar a transmitir vira linha; parar não", () => {
    const upd = (screensharing: boolean) => ({
      type: "UserVoiceStateUpdate",
      id: "JU",
      channel_id: SALA,
      data: { screensharing },
    });
    expect(linhasDoEvento(upd(true), SALA, 0)[0]?.sistema).toEqual({ tipo: "transmitiu", userId: "JU" });
    expect(linhasDoEvento(upd(false), SALA, 0)).toEqual([]);
    expect(linhasDoEvento({ ...upd(true), channel_id: OUTRA }, SALA, 0)).toEqual([]);
  });

  it("ServerMemberUpdate sem `by` (um delta Stoat) não anota nada", () => {
    anotarAutorDeVoz({ type: "ServerMemberUpdate", id: { user: "TEO" }, data: {} }, 0);
    expect(
      linhasDoEvento({ type: "VoiceChannelLeave", id: SALA, user: "TEO" }, SALA, 1)[0]?.sistema.tipo,
    ).toBe("saiu");
  });
});

describe("ponte até a lista", () => {
  /* O quadro é disparado À MÃO: um stub que chama o callback na hora e
     devolve 0 deixaria `flushHandle` em 0 para sempre (`??=` não trata 0 como
     ausente), e só a primeira publicação da suíte chegaria à lista. */
  let quadro: FrameRequestCallback | undefined;
  function publicar() {
    const cb = quadro;
    quadro = undefined;
    cb?.(0);
  }

  beforeEach(async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      quadro = cb;
      return 1;
    });
    await seed(4);
    publicar();
    limparChamada();
    limparEventosDaSala();
  });

  afterEach(() => {
    definirChamada({ estado: "fora", channelId: "" });
    publicar();
    vi.unstubAllGlobals();
  });

  function emitir(evento: Record<string, unknown>) {
    client.events.emit("event", evento as never);
    publicar();
  }

  it("entrar na sala em que estou vira linha de sistema no fim da lista", () => {
    definirChamada({ estado: "dentro", channelId: SALA });
    const antes = channelMessageIds.peek(SALA)?.length ?? 0;

    emitir({ type: "VoiceChannelJoin", id: SALA, state: estado("01JQ0000000000000001000005") });

    const ids = channelMessageIds.peek(SALA) ?? [];
    expect(ids).toHaveLength(antes + 1);
    const id = ids[ids.length - 1]!;
    expect(ehLinhaDeSala(id)).toBe(true);
    messages.subscriber(id)(() => {});
    expect(messages.peek(id)?.sistema).toEqual({
      tipo: "entrou",
      userId: "01JQ0000000000000001000005",
    });
  });

  it("fora da chamada o mesmo evento não escreve nada", () => {
    const antes = channelMessageIds.peek(SALA)?.length ?? 0;
    emitir({ type: "VoiceChannelJoin", id: SALA, state: estado("01JQ0000000000000001000005") });
    expect(channelMessageIds.peek(SALA)?.length ?? 0).toBe(antes);
  });

  it("sair da chamada apaga as linhas — elas são só de quem está conectado", () => {
    definirChamada({ estado: "dentro", channelId: SALA });
    const antes = channelMessageIds.peek(SALA)?.length ?? 0;
    emitir({ type: "VoiceChannelJoin", id: SALA, state: estado("01JQ0000000000000001000005") });
    emitir({ type: "VoiceChannelLeave", id: SALA, user: "01JQ0000000000000001000005" });
    expect(channelMessageIds.peek(SALA)).toHaveLength(antes + 2);

    definirChamada({ estado: "fora", channelId: "" });
    publicar();

    const depois = channelMessageIds.peek(SALA) ?? [];
    expect(depois).toHaveLength(antes);
    expect(depois.some(ehLinhaDeSala)).toBe(false);
  });
});
