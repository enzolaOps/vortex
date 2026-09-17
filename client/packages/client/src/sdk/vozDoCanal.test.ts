import { beforeEach, describe, expect, it } from "vitest";

import {
  VOZ_PADRAO,
  anotarEventoDeVoz,
  corpoDeVoz,
  lerConfigDeVoz,
  lerVozBruta,
  limparConfigDeVoz,
  publicacaoDe,
} from "./vozDoCanal";

describe("lerVozBruta", () => {
  it("objeto sem campos do fork é o padrão, pela mesma referência", () => {
    expect(lerVozBruta({ max_users: 8 })).toBe(VOZ_PADRAO);
    expect(lerVozBruta(undefined)).toBe(VOZ_PADRAO);
  });

  it("lê os três campos", () => {
    expect(
      lerVozBruta({ bitrate: 96, rtc_region: "br", video_quality: "1080p60" }),
    ).toEqual({ bitrateKbps: 96, regiao: "br", modoDeVideo: "1080p60" });
  });

  it("lixo vira ausência e não um valor aparado", () => {
    expect(lerVozBruta({ bitrate: 0 }).bitrateKbps).toBeUndefined();
    expect(lerVozBruta({ bitrate: 9999 }).bitrateKbps).toBeUndefined();
    expect(lerVozBruta({ bitrate: 64.5 }).bitrateKbps).toBeUndefined();
    expect(lerVozBruta({ rtc_region: "" }).regiao).toBeUndefined();
    expect(lerVozBruta({ video_quality: "4k" }).modoDeVideo).toBe("auto");
  });
});

describe("corpoDeVoz", () => {
  it("manda os quatro campos juntos, porque o servidor substitui o objeto", () => {
    expect(
      corpoDeVoz({
        limiteDeUsuarios: 8,
        bitrateKbps: 96,
        regiao: "br",
        modoDeVideo: "720p30",
      }),
    ).toEqual({ max_users: 8, bitrate: 96, rtc_region: "br", video_quality: "720p30" });
  });

  it("sem limite, automática e padrão são AUSÊNCIA — nunca zero", () => {
    expect(
      corpoDeVoz({
        limiteDeUsuarios: 0,
        bitrateKbps: undefined,
        regiao: undefined,
        modoDeVideo: "auto",
      }),
    ).toEqual({});
  });

  it("prende o bitrate na faixa da tela", () => {
    const base = { limiteDeUsuarios: 0, regiao: undefined, modoDeVideo: "auto" as const };
    expect(corpoDeVoz({ ...base, bitrateKbps: 500 })["bitrate"]).toBe(128);
    expect(corpoDeVoz({ ...base, bitrateKbps: 1 })["bitrate"]).toBe(8);
  });
});

describe("publicacaoDe", () => {
  it("bitrate de áudio em bps, e nenhum teto de vídeo no automático", () => {
    expect(publicacaoDe({ ...VOZ_PADRAO, bitrateKbps: 64 })).toEqual({
      audioMaxBitrate: 64_000,
      video: undefined,
    });
    expect(publicacaoDe(VOZ_PADRAO).audioMaxBitrate).toBeUndefined();
  });

  it("os dois modos fixam resolução e taxa", () => {
    expect(publicacaoDe({ ...VOZ_PADRAO, modoDeVideo: "720p30" }).video).toMatchObject({
      altura: 720,
      fps: 30,
    });
    expect(publicacaoDe({ ...VOZ_PADRAO, modoDeVideo: "1080p60" }).video).toMatchObject({
      altura: 1080,
      fps: 60,
    });
  });
});

describe("anotarEventoDeVoz", () => {
  beforeEach(() => limparConfigDeVoz());

  it("semeia do Ready, dentro de Bulk", () => {
    anotarEventoDeVoz({
      type: "Bulk",
      v: [{ type: "Ready", channels: [{ _id: "C1", voice: { bitrate: 96 } }] }],
    });
    expect(lerConfigDeVoz("C1").bitrateKbps).toBe(96);
  });

  it("ChannelUpdate sem voz NÃO apaga a configuração", () => {
    anotarEventoDeVoz({ type: "ChannelCreate", _id: "C1", voice: { bitrate: 96 } });
    const antes = lerConfigDeVoz("C1");
    expect(anotarEventoDeVoz({ type: "ChannelUpdate", id: "C1", data: { name: "x" } })).toBe(
      false,
    );
    expect(lerConfigDeVoz("C1")).toBe(antes);
  });

  it("ChannelUpdate com voz substitui; clear Voice volta ao padrão", () => {
    anotarEventoDeVoz({ type: "ChannelCreate", _id: "C1", voice: { bitrate: 96 } });
    anotarEventoDeVoz({
      type: "ChannelUpdate",
      id: "C1",
      data: { voice: { rtc_region: "br" } },
    });
    expect(lerConfigDeVoz("C1")).toEqual({
      bitrateKbps: undefined,
      regiao: "br",
      modoDeVideo: "auto",
    });
    anotarEventoDeVoz({ type: "ChannelUpdate", id: "C1", data: {}, clear: ["Voice"] });
    expect(lerConfigDeVoz("C1")).toBe(VOZ_PADRAO);
  });

  it("releitura igual não troca a referência", () => {
    anotarEventoDeVoz({ type: "ChannelCreate", _id: "C1", voice: { bitrate: 96 } });
    const antes = lerConfigDeVoz("C1");
    expect(
      anotarEventoDeVoz({ type: "ChannelUpdate", id: "C1", data: { voice: { bitrate: 96 } } }),
    ).toBe(false);
    expect(lerConfigDeVoz("C1")).toBe(antes);
  });
});
