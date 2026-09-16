import { describe, expect, it } from "vitest";

import {
  aplicarEventoCru,
  CAMPOS_PADRAO,
  camposDe,
  criarEstado,
  ehMencionavel,
} from "./superficieVortex";

/**
 * O que o SDK descarta, lido do fio. Cada caso aqui é um jeito de o campo
 * sumir em silêncio: parcial tratado como inteiro, `Bulk` não desembrulhado,
 * cargo apagado que continuaria mencionável.
 */
describe("canal", () => {
  it("Ready semeia só o que está ligado, e ausência é padrão", () => {
    const e = criarEstado();
    const m = aplicarEventoCru(e, {
      type: "Ready",
      channels: [
        { _id: "A", channel_type: "TextChannel", spoiler: true },
        { _id: "B", channel_type: "TextChannel" },
      ],
    });
    expect(m.canais).toEqual(["A"]);
    expect(camposDe(e, "A")).toEqual({ spoiler: true, convitesPausados: false });
    expect(camposDe(e, "B")).toBe(CAMPOS_PADRAO);
  });

  /* Renomear um canal não pode apagar o spoiler dele. */
  it("ChannelUpdate mescla: campo ausente não muda", () => {
    const e = criarEstado();
    aplicarEventoCru(e, { type: "ChannelCreate", _id: "A", spoiler: true });
    const m = aplicarEventoCru(e, { type: "ChannelUpdate", id: "A", data: { name: "x" } });
    expect(m.canais).toEqual([]);
    expect(camposDe(e, "A").spoiler).toBe(true);

    aplicarEventoCru(e, { type: "ChannelUpdate", id: "A", data: { invites_paused: true } });
    expect(camposDe(e, "A")).toEqual({ spoiler: true, convitesPausados: true });

    aplicarEventoCru(e, {
      type: "ChannelUpdate",
      id: "A",
      data: { spoiler: false, invites_paused: false },
    });
    expect(camposDe(e, "A")).toBe(CAMPOS_PADRAO);
  });

  it("Bulk é desembrulhado", () => {
    const e = criarEstado();
    const m = aplicarEventoCru(e, {
      type: "Bulk",
      v: [{ type: "ChannelUpdate", id: "A", data: { invites_paused: true } }],
    });
    expect(m.canais).toEqual(["A"]);
    expect(camposDe(e, "A").convitesPausados).toBe(true);
  });

  it("ChannelDelete esquece", () => {
    const e = criarEstado();
    aplicarEventoCru(e, { type: "ChannelCreate", _id: "A", spoiler: true });
    aplicarEventoCru(e, { type: "ChannelDelete", id: "A" });
    expect(camposDe(e, "A")).toBe(CAMPOS_PADRAO);
  });
});

describe("cargo", () => {
  it("Ready e ServerCreate leem `mentionable` de cada cargo", () => {
    const e = criarEstado();
    aplicarEventoCru(e, {
      type: "Ready",
      servers: [{ _id: "S", roles: { R1: { mentionable: true }, R2: { name: "x" } } }],
    });
    expect(ehMencionavel(e, "S", "R1")).toBe(true);
    expect(ehMencionavel(e, "S", "R2")).toBe(false);
  });

  it("ServerRoleUpdate liga e desliga; sem o campo, não mexe", () => {
    const e = criarEstado();
    const liga = aplicarEventoCru(e, {
      type: "ServerRoleUpdate",
      id: "S",
      role_id: "R",
      data: { mentionable: true },
    });
    expect(liga.servidores).toEqual(["S"]);
    expect(ehMencionavel(e, "S", "R")).toBe(true);

    aplicarEventoCru(e, { type: "ServerRoleUpdate", id: "S", role_id: "R", data: { name: "y" } });
    expect(ehMencionavel(e, "S", "R")).toBe(true);

    aplicarEventoCru(e, {
      type: "ServerRoleUpdate",
      id: "S",
      role_id: "R",
      data: { mentionable: false },
    });
    expect(ehMencionavel(e, "S", "R")).toBe(false);
  });

  it("cargo apagado deixa de ser mencionável", () => {
    const e = criarEstado();
    aplicarEventoCru(e, { type: "ServerRoleUpdate", id: "S", role_id: "R", data: { mentionable: true } });
    aplicarEventoCru(e, { type: "ServerRoleDelete", id: "S", role_id: "R" });
    expect(ehMencionavel(e, "S", "R")).toBe(false);
  });

  it("lixo não quebra", () => {
    const e = criarEstado();
    for (const lixo of [null, 3, "x", { type: "ChannelUpdate" }, { type: "Bulk", v: 1 }]) {
      expect(aplicarEventoCru(e, lixo)).toEqual({ canais: [], servidores: [] });
    }
  });
});
