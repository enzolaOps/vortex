import { describe, expect, it } from "vitest";

import { codigoDeModelo, modeloDe, resumoDe } from "./modeloDoServidor";

describe("resumo da estrutura", () => {
  it("conta categorias, canais, cargos e exceções", () => {
    expect(
      resumoDe({
        categories: [{}, {}],
        roles: [{}, {}, {}],
        channels: [
          /* padrão do canal + dois cargos = 3 exceções */
          { default_permissions: { a: 0, d: 1 }, role_permissions: { R1: {}, R2: {} } },
          /* canal sem exceção nenhuma */
          {},
          /* só um cargo */
          { role_permissions: { R1: {} } },
        ],
      }),
    ).toEqual({ categorias: 2, canais: 3, cargos: 3, excecoes: 4 });
  });

  it("estrutura vazia é zero em tudo, não erro", () => {
    expect(resumoDe({})).toEqual({ categorias: 0, canais: 0, cargos: 0, excecoes: 0 });
  });

  it("`default_permissions: null` não conta como exceção", () => {
    expect(resumoDe({ channels: [{ default_permissions: null }] }).excecoes).toBe(0);
  });
});

describe("modelo do servidor", () => {
  it("traduz o modelo com o estado de sincronização", () => {
    const m = modeloDe({
      is_dirty: true,
      template: {
        _id: "Ab3Cd4Ef5G",
        name: "Base",
        created_at: "2026-08-12T00:00:00Z",
        uses: 14,
        snapshot: { channels: [{}] },
      },
    });
    expect(m).toEqual({
      codigo: "Ab3Cd4Ef5G",
      nome: "Base",
      criadoEmMs: Date.parse("2026-08-12T00:00:00Z"),
      usos: 14,
      desatualizado: true,
      resumo: { categorias: 0, canais: 1, cargos: 0, excecoes: 0 },
    });
  });

  it("modelo sem `uses` (nunca usado) conta zero", () => {
    const m = modeloDe({
      is_dirty: false,
      template: { _id: "x", name: "n", created_at: "2026-01-01T00:00:00Z", snapshot: {} },
    });
    expect(m.usos).toBe(0);
  });
});

describe("código de modelo", () => {
  it.each([
    ["Ab3Cd4Ef5G", "Ab3Cd4Ef5G"],
    ["  Ab3Cd4Ef5G  ", "Ab3Cd4Ef5G"],
    ["vortex.gg/t/Ab3Cd4Ef5G", "Ab3Cd4Ef5G"],
    ["https://vortex.exemplo/t/Ab3Cd4Ef5G?ref=x", "Ab3Cd4Ef5G"],
    ["https://vortex.exemplo/t/Ab3Cd4Ef5G/", "Ab3Cd4Ef5G"],
  ])("%s → %s", (entrada, esperado) => {
    expect(codigoDeModelo(entrada)).toBe(esperado);
  });

  it.each([
    "",
    "   ",
    /* Link de CONVITE colado no lugar errado não vira código de modelo. */
    "https://vortex.exemplo/convite/Ab3Cd4Ef5G",
    "abc",
    "Ab3 Cd4",
  ])("%s não é modelo", (entrada) => {
    expect(codigoDeModelo(entrada)).toBeUndefined();
  });
});
