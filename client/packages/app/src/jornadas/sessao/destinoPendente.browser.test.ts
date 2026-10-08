import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRAZO_DO_CONVITE_MS,
  esquecerConvite,
  guardarConvite,
  guardarPedidoDeQr,
  lerDestino,
  limparDestino,
  reabrirDestino,
} from "./destinoPendente";

const CHAVE = "vortex.convite-pendente";

beforeEach(() => {
  limparDestino();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  limparDestino();
});

describe("destino pendente: o convite entre abas", () => {
  it("fica no localStorage e sobrevive a uma página recém-aberta (outra aba)", () => {
    guardarConvite("abc123");
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toMatchObject({ codigo: "abc123" });
    reabrirDestino();
    expect(lerDestino().convite).toBe("abc123");
  });

  it("o consumo é único: esquecer apaga do armazenamento", () => {
    guardarConvite("abc123");
    esquecerConvite();
    expect(localStorage.getItem(CHAVE)).toBeNull();
    reabrirDestino();
    expect(lerDestino().convite).toBeUndefined();
  });

  it("vence em 24 horas, na leitura nova e na memória", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T10:00:00Z"));
    guardarConvite("abc123");
    vi.setSystemTime(Date.now() + PRAZO_DO_CONVITE_MS - 1000);
    reabrirDestino();
    expect(lerDestino().convite).toBe("abc123");

    vi.setSystemTime(Date.now() + 2000);
    expect(lerDestino().convite).toBeUndefined(); // cópia em memória
    reabrirDestino();
    expect(lerDestino().convite).toBeUndefined(); // e o lixo some do armazenamento
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("outra aba consumiu: o evento de storage larga a cópia e avisa quem assina", () => {
    guardarConvite("abc123");
    localStorage.removeItem(CHAVE);
    window.dispatchEvent(new StorageEvent("storage", { key: CHAVE, newValue: null }));
    expect(lerDestino().convite).toBeUndefined();
  });

  it("armazenamento corrompido ou bloqueado não derruba nada", () => {
    localStorage.setItem(CHAVE, "{não é json");
    reabrirDestino();
    expect(lerDestino()).toEqual({});

    localStorage.setItem(CHAVE, JSON.stringify({ codigo: 7, ate: "x" }));
    reabrirDestino();
    expect(lerDestino()).toEqual({});

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    reabrirDestino();
    expect(() => {
      guardarConvite("xyz");
    }).not.toThrow();
    expect(lerDestino().convite).toBe("xyz"); // vale até recarregar
  });

  it("o pedido de QR continua na aba e não vai para o localStorage", () => {
    guardarPedidoDeQr("01Q");
    expect(localStorage.getItem(CHAVE)).toBeNull();
    reabrirDestino();
    expect(lerDestino().qr).toBe("01Q");
  });
});
