import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  client: {} as {
    configuration: { ws?: string } | undefined;
    configured: () => boolean;
  },
  setConfigurado: undefined as unknown as (v: boolean) => void,
}));

vi.mock("./client", async () => {
  const { createSignal: sinal } = await import("solid-js");
  const [configurado, setConfigurado] = sinal(false);
  estado.client.configuration = undefined;
  estado.client.configured = configurado;
  estado.setConfigurado = setConfigurado;
  return { client: estado.client };
});

import { esperarConfiguracao } from "./config";


beforeEach(() => {
  vi.useFakeTimers();
  estado.client.configuration = undefined;
  estado.setConfigurado(false);
});
afterEach(() => vi.useRealTimers());

describe("esperarConfiguracao", () => {
  it("resolve na hora quando a configuração já chegou", async () => {
    estado.client.configuration = { ws: "wss://x" };
    await expect(esperarConfiguracao()).resolves.toBe(true);
  });

  it("resolve quando ela chega, sem sondagem por temporizador", async () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    const p = esperarConfiguracao();
    // Só o teto de 15 s é agendado; nenhum passo de 50 ms.
    expect(spy.mock.calls.map((c) => c[1])).toEqual([15_000]);

    await vi.advanceTimersByTimeAsync(3_000);
    estado.client.configuration = { ws: "wss://x" };
    estado.setConfigurado(true);
    await expect(p).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    spy.mockRestore();
  });

  it("estoura no teto de 15 s com false", async () => {
    const p = esperarConfiguracao();
    await vi.advanceTimersByTimeAsync(14_999);
    let fim = false;
    void p.then(() => (fim = true));
    await Promise.resolve();
    expect(fim).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await expect(p).resolves.toBe(false);
  });

  it("chegada depois do teto não muda a resposta", async () => {
    const p = esperarConfiguracao();
    await vi.advanceTimersByTimeAsync(15_001);
    estado.client.configuration = { ws: "wss://x" };
    estado.setConfigurado(true);
    await expect(p).resolves.toBe(false);
  });
});
