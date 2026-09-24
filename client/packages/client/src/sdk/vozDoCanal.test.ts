import { beforeEach, describe, expect, it } from "vitest";

import {
  VOZ_PADRAO,
  abreNaGrade,
  anotarEventoDeVoz,
  consumirModosAlterados,
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
    ).toEqual({ modoDaSala: "voz", bitrateKbps: 96, regiao: "br", modoDeVideo: "1080p60" });
  });

  it("lê o tipo da sala do `kind` do fork, e ausente é voz", () => {
    expect(lerVozBruta({ kind: "video" }).modoDaSala).toBe("video");
    expect(lerVozBruta({ kind: "stage" }).modoDaSala).toBe("palco");
    // `voice` explícito sem outro campo é o padrão, pela mesma referência.
    expect(lerVozBruta({ kind: "voice" })).toBe(VOZ_PADRAO);
    // Valor que este cliente não conhece degrada para voz, não quebra a sala.
    expect(lerVozBruta({ kind: "forum" }).modoDaSala).toBe("voz");
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
        modoDaSala: "video",
        limiteDeUsuarios: 8,
        bitrateKbps: 96,
        regiao: "br",
        modoDeVideo: "720p30",
      }),
    ).toEqual({
      kind: "video",
      max_users: 8,
      bitrate: 96,
      rtc_region: "br",
      video_quality: "720p30",
    });
  });

  it("sem limite, automática e padrão são AUSÊNCIA — nunca zero", () => {
    expect(
      corpoDeVoz({
        modoDaSala: "voz",
        limiteDeUsuarios: 0,
        bitrateKbps: undefined,
        regiao: undefined,
        modoDeVideo: "auto",
      }),
    ).toEqual({ kind: "voice" });
  });

  it("`kind` vai sempre, inclusive voz — o servidor mantém o gravado quando falta", () => {
    const base = {
      limiteDeUsuarios: 0,
      bitrateKbps: undefined,
      regiao: undefined,
      modoDeVideo: "auto" as const,
    };
    expect(corpoDeVoz({ ...base, modoDaSala: "voz" })["kind"]).toBe("voice");
    expect(corpoDeVoz({ ...base, modoDaSala: "palco" })["kind"]).toBe("stage");
  });

  it("prende o bitrate na faixa da tela", () => {
    const base = {
      modoDaSala: "voz" as const,
      limiteDeUsuarios: 0,
      regiao: undefined,
      modoDeVideo: "auto" as const,
    };
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
      modoDaSala: "voz",
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

  it("só a mudança de TIPO da sala pede republicar o canal", () => {
    consumirModosAlterados();
    anotarEventoDeVoz({ type: "ChannelCreate", _id: "C1", voice: { bitrate: 96 } });
    // Bitrate não está no snapshot do canal: nada a republicar.
    expect(consumirModosAlterados()).toEqual([]);

    anotarEventoDeVoz({
      type: "ChannelUpdate",
      id: "C1",
      data: { voice: { bitrate: 96, kind: "video" } },
    });
    expect(lerConfigDeVoz("C1").modoDaSala).toBe("video");
    expect(consumirModosAlterados()).toEqual(["C1"]);
    // Consumido uma vez: a segunda leitura não republica de novo.
    expect(consumirModosAlterados()).toEqual([]);

    anotarEventoDeVoz({ type: "ChannelUpdate", id: "C1", data: {}, clear: ["Voice"] });
    expect(consumirModosAlterados()).toEqual(["C1"]);
  });
});

describe("abreNaGrade", () => {
  it("só a sala de vídeo abre na grade", () => {
    expect(abreNaGrade("video")).toBe(true);
    expect(abreNaGrade("voz")).toBe(false);
    expect(abreNaGrade("palco")).toBe(false);
  });
});
