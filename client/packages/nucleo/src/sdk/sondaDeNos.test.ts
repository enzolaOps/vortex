import { describe, expect, it, vi } from "vitest";

import { escolherNoMaisRapido } from "./sondaDeNos";

const A = { name: "a", public_url: "wss://a.exemplo" };
const B = { name: "b", public_url: "wss://b.exemplo" };

describe("escolherNoMaisRapido", () => {
  it("pula a sondagem com no máximo um nó", async () => {
    const buscar = vi.fn();
    expect(await escolherNoMaisRapido([], { buscar })).toBeUndefined();
    expect(await escolherNoMaisRapido([A], { buscar })).toBe("a");
    expect(buscar).not.toHaveBeenCalled();
  });

  it("devolve o primeiro nó a responder", async () => {
    const buscar = vi.fn((url: string) =>
      url.includes("b.") ? Promise.resolve() : new Promise<never>(() => {}),
    );
    expect(
      await escolherNoMaisRapido([A, B], { buscar: buscar as never }),
    ).toBe("b");
    expect(buscar.mock.calls[0]?.[0]).toBe("https://a.exemplo");
  });

  it("desiste no timeout em vez de segurar a entrada", async () => {
    vi.useFakeTimers();
    try {
      const buscar = vi.fn(() => new Promise<never>(() => {}));
      const p = escolherNoMaisRapido([A, B], {
        buscar,
        limiteMs: 1500,
      });
      await vi.advanceTimersByTimeAsync(1500);
      expect(await p).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
