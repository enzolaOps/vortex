import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seed } from "../dev/firehose";
import { definirChamada, limparChamada } from "../store/chamada";
import { channelMessageIds, messages } from "./adapter";
import { client } from "./client";
import {
  ehLinhaDeSala,
  limparEventosDaSala,
  linhasDoEvento,
  soltarLinhasDe,
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
    expect(linhasDoEvento({ type: "VoiceChannelJoin", id: SALA, state: estado("JU") }, "")).toEqual(
      [],
    );
  });

  it("só a sala em que se está", () => {
    expect(
      linhasDoEvento({ type: "VoiceChannelJoin", id: OUTRA, state: estado("JU") }, SALA),
    ).toEqual([]);
    expect(
      linhasDoEvento({ type: "VoiceChannelJoin", id: SALA, state: estado("JU") }, SALA),
    ).toEqual([{ canal: SALA, userId: "JU", sistema: { tipo: "entrou", userId: "JU" } }]);
  });

  it("saída vira `saiu`, e movimento entra de qualquer lado, SEM autor", () => {
    expect(linhasDoEvento({ type: "VoiceChannelLeave", id: SALA, user: "NANDO" }, SALA)).toEqual([
      { canal: SALA, userId: "NANDO", sistema: { tipo: "saiu", userId: "NANDO" } },
    ]);
    /* Mesmo que um payload traga `by`, a sala não o lê: autor é só da pessoa
       afetada, por evento privado. */
    const mov = {
      type: "VoiceChannelMove",
      user: "TEO",
      from: SALA,
      to: OUTRA,
      by: "ANA",
      state: estado("TEO"),
    };
    expect(linhasDoEvento(mov, SALA)[0]?.sistema).toEqual({
      tipo: "moveu",
      userId: "TEO",
      paraId: OUTRA,
    });
    expect(linhasDoEvento(mov, OUTRA)[0]?.sistema.tipo).toBe("moveu");
    expect(linhasDoEvento(mov, "01TERCEIRA")).toEqual([]);
  });

  it("começar a transmitir vira linha; parar não", () => {
    const upd = (screensharing: boolean) => ({
      type: "UserVoiceStateUpdate",
      id: "JU",
      channel_id: SALA,
      data: { screensharing },
    });
    expect(linhasDoEvento(upd(true), SALA)[0]?.sistema).toEqual({ tipo: "transmitiu", userId: "JU" });
    expect(linhasDoEvento(upd(false), SALA)).toEqual([]);
    expect(linhasDoEvento({ ...upd(true), channel_id: OUTRA }, SALA)).toEqual([]);
  });

  it("segundo true não duplica; false, saída e soltar liberam o próximo começo", () => {
    const upd = (screensharing: boolean) => ({
      type: "UserVoiceStateUpdate",
      id: "JU",
      channel_id: SALA,
      data: { screensharing },
    });
    expect(linhasDoEvento(upd(true), SALA)).toHaveLength(1);
    /* Faixa de áudio da tela e unmute: o mesmo true, sem linha nova. */
    expect(linhasDoEvento(upd(true), SALA)).toEqual([]);
    /* Movido para fora: o leave é suprimido, então o false também não vem. */
    linhasDoEvento({ type: "VoiceChannelMove", user: "JU", from: SALA, to: OUTRA }, SALA);
    expect(linhasDoEvento(upd(true), SALA)).toHaveLength(1);
    expect(linhasDoEvento(upd(false), SALA)).toEqual([]);
    expect(linhasDoEvento(upd(true), SALA)).toHaveLength(1);

    linhasDoEvento({ type: "VoiceChannelLeave", id: SALA, user: "JU" }, SALA);
    expect(linhasDoEvento(upd(true), SALA)).toHaveLength(1);

    soltarLinhasDe(SALA);
    expect(linhasDoEvento(upd(true), SALA)).toHaveLength(1);
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
