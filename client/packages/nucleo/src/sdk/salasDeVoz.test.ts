import { beforeEach, describe, expect, it } from "vitest";

import {
  aplicarEventoDeVoz,
  canalDeVozDaPessoa,
  limparSalasDeVoz,
  participantesDaSala,
} from "./salasDeVoz";

const A = "canalA";
const B = "canalB";
const ANA = "ana";
const EU = "eu";

const estado = (id: string, extra: object = {}) => ({
  id,
  joined_at: "2026-10-07T12:00:00.000Z",
  is_receiving: true,
  is_publishing: true,
  screensharing: false,
  camera: false,
  ...extra,
});

const quem = (canal: string) => [...participantesDaSala(canal).keys()];

beforeEach(limparSalasDeVoz);

describe("salas de voz por evento cru", () => {
  it("Ready semeia e substitui o que havia", () => {
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: B, state: estado("velho") }, EU);
    const mudou = aplicarEventoDeVoz(
      {
        type: "Ready",
        voice_states: [{ id: A, participants: [estado(ANA), estado("bia")] }],
      },
      EU,
    );
    expect(quem(A)).toEqual([ANA, "bia"]);
    expect(quem(B)).toEqual([]);
    expect(mudou).toEqual(expect.arrayContaining([A, B]));
  });

  it("Ready sem voice_states não apaga as salas", () => {
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: A, state: estado(ANA) }, EU);
    expect(aplicarEventoDeVoz({ type: "Ready" }, EU)).toEqual([]);
    expect(quem(A)).toEqual([ANA]);
  });

  it("VoiceChannelJoin põe a pessoa na sala", () => {
    const mudou = aplicarEventoDeVoz(
      { type: "VoiceChannelJoin", id: A, state: estado(ANA, { camera: true }) },
      EU,
    );
    expect(mudou).toEqual([A]);
    expect(participantesDaSala(A).get(ANA)).toMatchObject({
      camera: true,
      desde: Date.parse("2026-10-07T12:00:00.000Z"),
    });
  });

  it("VoiceChannelLeave tira, e sair duas vezes é no-op", () => {
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: A, state: estado(ANA) }, EU);
    const sair = { type: "VoiceChannelLeave", id: A, user: ANA };
    expect(aplicarEventoDeVoz(sair, EU)).toEqual([A]);
    expect(quem(A)).toEqual([]);
    expect(aplicarEventoDeVoz(sair, EU)).toEqual([]);
  });

  it("VoiceChannelMove tira da origem e põe no destino", () => {
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: A, state: estado(ANA) }, EU);
    const mudou = aplicarEventoDeVoz(
      { type: "VoiceChannelMove", user: ANA, from: A, to: B, state: estado(ANA) },
      EU,
    );
    expect(mudou).toEqual([A, B]);
    expect(quem(A)).toEqual([]);
    expect(quem(B)).toEqual([ANA]);
  });

  it("UserVoiceStateUpdate mescla parcial e ignora quem não está na sala", () => {
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: A, state: estado(ANA) }, EU);
    aplicarEventoDeVoz(
      { type: "UserVoiceStateUpdate", id: ANA, channel_id: A, data: { screensharing: true } },
      EU,
    );
    expect(participantesDaSala(A).get(ANA)).toMatchObject({
      tela: true,
      publicando: true,
      desde: Date.parse("2026-10-07T12:00:00.000Z"),
    });
    expect(
      aplicarEventoDeVoz(
        { type: "UserVoiceStateUpdate", id: "estranho", channel_id: A, data: { camera: true } },
        EU,
      ),
    ).toEqual([]);
    expect(quem(A)).toEqual([ANA]);
  });

  it("UserMoveVoiceChannel tira VOCÊ da origem", () => {
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: A, state: estado(EU) }, EU);
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: A, state: estado(ANA) }, EU);
    const mudou = aplicarEventoDeVoz(
      { type: "UserMoveVoiceChannel", node: "n", from: A, to: B, token: "t" },
      EU,
    );
    expect(mudou).toEqual([A]);
    expect(quem(A)).toEqual([ANA]);
  });

  it("join → move → leave: quem é movido deixa a sala de origem (o fantasma)", () => {
    aplicarEventoDeVoz({ type: "VoiceChannelJoin", id: A, state: estado(ANA) }, EU);
    expect(canalDeVozDaPessoa(ANA)).toBe(A);

    aplicarEventoDeVoz(
      { type: "VoiceChannelMove", user: ANA, from: A, to: B, state: estado(ANA) },
      EU,
    );
    expect(quem(A)).not.toContain(ANA);
    expect(canalDeVozDaPessoa(ANA)).toBe(B);

    aplicarEventoDeVoz({ type: "VoiceChannelLeave", id: B, user: ANA }, EU);
    expect(canalDeVozDaPessoa(ANA)).toBeUndefined();
  });
});
