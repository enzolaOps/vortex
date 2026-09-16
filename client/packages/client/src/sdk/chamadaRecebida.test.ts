import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  chamadaRecebidaFalsa,
  desistirDaChamadaFalsa,
  seed,
} from "../dev/firehose";
import {
  lerChamadaRecebida,
  limparChamadaRecebida,
} from "../store/chamadaRecebida";
import { client } from "./client";

/**
 * A TRADUÇÃO do sinal de chamada — evento cru do protocolo até o store.
 *
 * ⚠ **É a metade que quebra em silêncio.** O `stoat.js` descarta
 * `VoiceCallUpdate` (não há `case` para ele), então o adapter o lê do evento
 * cru; se alguém trocar o nome de um campo ou o filtro de tipo de canal, o
 * aviso simplesmente nunca aparece e nada falha. O redutor tem os próprios
 * testes em `store/chamadaRecebida.test.ts`; estes guardam a ponte.
 *
 * Os eventos são emitidos no `EventClient` de verdade, na ordem do
 * `voice-ingress` — o SDK aplica o `VoiceChannelJoin` no `ReactiveMap` antes
 * de o adapter ouvir, que é a ordem que o adapter precisa tolerar.
 */

const DM = "01JQ000000000000000A000000";
/* A sala VAZIA do servidor: numa ocupada a regra de "juntar-se" já calaria o
   toque, e o teste aprovaria sem o filtro de tipo de canal existir. */
const VOZ_VAZIA = "01JQ0000000000000000000014";

/* Uma quarta às 15:00 — fora do horário de silêncio padrão (22h–8h). */
const QUARTA_15H = new Date(2026, 8, 16, 15, 0);

function emitir(evento: Record<string, unknown>) {
  client.events.emit("event", evento as never);
}

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

describe("chamada recebida — o sinal do protocolo", () => {
  beforeEach(async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(QUARTA_15H);
    await seed(4);
    limparChamadaRecebida();
    /* Esvazia a DM entre testes: o `ReactiveMap` do SDK sobrevive ao seed. */
    client.channels.get(DM)?.voiceParticipants.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("alguém entrar numa DM vazia faz tocar", () => {
    chamadaRecebidaFalsa();
    const t = lerChamadaRecebida();
    expect(t?.channelId).toBe(DM);
    expect(t?.quemLigou).toBeDefined();
    expect(t?.visivel).toBe(true);
  });

  it("`VoiceCallUpdate` sozinho também toca — ele é o sinal do protocolo", () => {
    const quem = client.channels.get(DM)?.recipientIds;
    const outro = [...(quem ?? [])][1]!;
    emitir({
      type: "VoiceCallUpdate",
      initiator_id: outro,
      channel_id: DM,
      started_at: new Date().toISOString(),
      ended: false,
    });
    expect(lerChamadaRecebida()?.quemLigou).toBe(outro);
  });

  it("quem ligou desistir para o toque", () => {
    chamadaRecebidaFalsa();
    expect(lerChamadaRecebida()).toBeDefined();
    desistirDaChamadaFalsa();
    expect(lerChamadaRecebida()).toBeUndefined();
  });

  it("`ended: true` para o toque", () => {
    chamadaRecebidaFalsa();
    emitir({ type: "VoiceCallUpdate", initiator_id: "x", channel_id: DM, ended: true });
    expect(lerChamadaRecebida()).toBeUndefined();
  });

  it("sala de SERVIDOR não toca — é lugar, não chamada", () => {
    emitir({ type: "VoiceChannelJoin", id: VOZ_VAZIA, state: estado("01JQALGUEM0000000000000000") });
    expect(lerChamadaRecebida()).toBeUndefined();
  });

  it("entrar numa DM que já tinha gente é juntar-se, não ligar", () => {
    const outro = [...(client.channels.get(DM)?.recipientIds ?? [])][1]!;
    emitir({ type: "VoiceChannelJoin", id: DM, state: estado("01JQPRIMEIRO00000000000000") });
    limparChamadaRecebida();
    emitir({ type: "VoiceChannelJoin", id: DM, state: estado(outro) });
    expect(lerChamadaRecebida()).toBeUndefined();
  });

  it("a sua própria entrada não toca para você", () => {
    const eu = [...(client.channels.get(DM)?.recipientIds ?? [])][0]!;
    emitir({ type: "VoiceChannelJoin", id: DM, state: estado(eu) });
    expect(lerChamadaRecebida()).toBeUndefined();
  });

  it("uma pessoa sair de uma sala que continua cheia NÃO para o toque", () => {
    chamadaRecebidaFalsa();
    emitir({ type: "VoiceChannelJoin", id: DM, state: estado("01JQTERCEIRO00000000000000") });
    emitir({ type: "VoiceChannelLeave", id: DM, user: "01JQTERCEIRO00000000000000" });
    expect(lerChamadaRecebida()).toBeDefined();
  });
});
